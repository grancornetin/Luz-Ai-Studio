// src/modules/outfitExtractor/OutfitExtractorModule.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ResultCard } from '../../components/shared/ResultCard';
import { ResultLibraryGrid } from '../../components/shared/ResultLibraryGrid';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../../services/creditConfig';
import { ModelSelector } from '../../components/shared/ModelSelector';
import { useModelSelection } from '../../hooks/useModelSelection';
import { generationHistoryService } from '../../services/generationHistoryService';
import { outfitService } from './outfitService';
import { outfitStorage } from './outfitStorage';
import { OutfitKit, OutfitItem, SavedOutfitItem, OutfitCombination } from './types';
import { downloadAsZip } from '../../utils/imageUtils';
import { useAuth } from '../../modules/auth/AuthContext';
import { ErrorCode, newSessionId, parseErrorCode } from '../../services/imageApiService';
import { getNotification } from '../../services/notificationsService';
import { useSearchParams } from 'react-router-dom';
import { GenerateButton } from '../../components/shared/GenerateButton';
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';
import { ImageSlot } from '../../components/shared/ImageSlot';
import UploadDisclaimer from '../../components/shared/UploadDisclaimer';
import { ImageLightbox } from '../../components/shared/ImageLightbox';

// ── Tipos ────────────────────────────────────────────────────────────────────

type FlowStep = 'idle' | 'detecting' | 'scan_overlay' | 'generating_renders' | 'reviewing_renders' | 'composing' | 'final_kit';
type LibraryView = 'kits' | 'items' | 'combinations' | 'creator';

// ── Pasos del wizard (barra de progreso visual) ──────────────────────────────

const OUTFIT_WIZARD_STEPS = [
  { id: 'upload',   label: 'Tu foto' },
  { id: 'select',   label: 'Elegir prendas' },
  { id: 'generate', label: 'Generar' },
  { id: 'results',  label: 'Resultados' },
];

// Mapea el flujo interno a un número de paso para el stepper
function flowToWizardStep(step: FlowStep): number {
  if (step === 'idle')                return 1;
  if (step === 'scan_overlay')        return 2;
  if (step === 'generating_renders')  return 3;
  if (step === 'reviewing_renders')   return 4;
  if (step === 'final_kit')           return 4;
  return 1;
}

// ── Sub-componente: header de paso ───────────────────────────────────────────

const StepHeader: React.FC<{ title: string; subtitle: string; icon: string }> = ({ title, subtitle, icon }) => (
  <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-6">
    <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-sm flex-shrink-0">
      <i className={`fa-solid ${icon} text-sm md:text-xl`} />
    </div>
    <div>
      <h2 className="t-display text-sm md:text-xl text-slate-900">{title}</h2>
      <p className="t-meta mt-0.5 md:mt-1">{subtitle}</p>
    </div>
  </div>
);

// ── Sub-componente: foto original con marcadores de prendas detectadas ──────
// Reusado en mobile (dentro del tab "Foto" del paso 2) y en desktop (columna
// derecha, siempre visible). Tocar una etiqueta selecciona/deselecciona esa
// prenda — misma acción que la lista.

const ScanOverlay: React.FC<{ kit: OutfitKit; onToggle: (id: string) => void }> = ({ kit, onToggle }) => (
  <div className="relative aspect-[3/4] mx-auto rounded-[28px] overflow-hidden">
    <img src={kit.originalImage} className="w-full h-full object-cover opacity-60 grayscale" />
    <div className="absolute inset-x-0 h-1 bg-brand-400 shadow-[0_0_15px_#FF748B] animate-scan z-30 opacity-50" />
    <style>{`@keyframes scan { 0% { top: 0%; } 100% { top: 100%; } } .animate-scan { animation: scan 3s linear infinite; }`}</style>
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
      {kit.items.map(item => {
        if (!item.selected) return null;
        const x = `${item.coordinates.x / 10}%`;
        const y = `${item.coordinates.y / 10}%`;
        return (
          <g key={`line-${item.id}`}>
            <circle cx={x} cy={y} r="5" fill="#FF748B" className="animate-pulse" />
            <line x1={x} y1={y} x2={x} y2={`${item.coordinates.y / 10 - 4}%`} stroke="#FF748B" strokeWidth="2" strokeDasharray="4" className="opacity-40" />
          </g>
        );
      })}
    </svg>
    {kit.items.map(item => (
      <button
        key={`label-${item.id}`}
        onClick={() => onToggle(item.id)}
        style={{ left: `${item.coordinates.x / 10}%`, top: `${item.coordinates.y / 10}%` }}
        className={`absolute z-20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all -translate-x-1/2 -translate-y-8 shadow-2xl border-2 min-w-[44px] min-h-[36px] ${item.selected ? 'bg-brand-600 text-white border-brand-400 scale-110' : 'bg-black/80 text-white/30 border-white/10 scale-90 opacity-60'}`}
      >
        {item.name}
      </button>
    ))}
  </div>
);

const RENDER_ITEM_DELAY_MS = 30000;
const RENDER_RETRY_DELAYS_MS = [60000, 120000, 180000];
const MAX_RENDER_ATTEMPTS = 1 + RENDER_RETRY_DELAYS_MS.length;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetryRenderError = (error: unknown) => {
  const appError = parseErrorCode(error);
  return [
    ErrorCode.RATE_LIMIT,
    ErrorCode.TIMEOUT,
    ErrorCode.SERVER_ERROR,
    ErrorCode.UNKNOWN,
  ].includes(appError.code);
};

// ── Módulo principal ─────────────────────────────────────────────────────────

const OutfitExtractorModule: React.FC = () => {
  const { credits, user } = useAuth();
  const { modelId, setModelId } = useModelSelection();

  const [step, setStep]           = useState<FlowStep>('idle');
  const [mainView, setMainView]   = useState<'main' | 'library'>('main');
  const [libView, setLibView]     = useState<LibraryView>('kits');
  // Mobile paso 2: elegir prendas por foto (con marcadores) o por lista.
  // Desktop siempre muestra ambas (columna izquierda = lista, derecha = foto).
  const [mobileScanTab, setMobileScanTab] = useState<'photo' | 'list'>('photo');

  const [sourceImage, setSourceImage]           = useState<string | null>(null);
  const [currentKit, setCurrentKit]             = useState<OutfitKit | null>(null);
  const [currentCombo, setCurrentCombo]         = useState<OutfitCombination | null>(null);
  const [libraryKits, setLibraryKits]           = useState<OutfitKit[]>([]);
  const [libraryItems, setLibraryItems]         = useState<SavedOutfitItem[]>([]);
  const [libraryCombinations, setLibraryCombinations] = useState<OutfitCombination[]>([]);

  const [loadingMsg, setLoadingMsg]     = useState('');
  const [isZipping, setIsZipping]       = useState(false);
  const [savedMsg, setSavedMsg]         = useState(false);
  // Evita guardar las mismas prendas 2 veces en la biblioteca: si el usuario
  // ya tocó "Guardar prendas" para el kit actual, "Crear imagen final" no
  // las vuelve a guardar (antes cada acción creaba IDs nuevos sin chequear).
  const [itemsAlreadySaved, setItemsAlreadySaved] = useState(false);
  const [creatorSelectedItems, setCreatorSelectedItems] = useState<SavedOutfitItem[]>([]);
  const [creatorName, setCreatorName]   = useState('Nueva combinación');

  const [lightboxOpen, setLightboxOpen]         = useState(false);
  const [lightboxImages, setLightboxImages]     = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex]       = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();
  const renderQueueRunningRef = useRef(false);

  const [searchParams, setSearchParams] = useSearchParams();

  // El paso "estable" del wizard vive también en la URL (?paso=scan_overlay)
  // para que el botón/gesto "atrás" nativo retroceda un paso en vez de sacar
  // al usuario del módulo. Los estados de carga (detecting/generating_renders/
  // composing) NO se reflejan en la URL — son transiciones automáticas y
  // breves; si el usuario navega afuera durante una de ellas, la generación
  // sigue corriendo en segundo plano (igual que ya funciona hoy) y el
  // resultado aparece en su Biblioteca al terminar, sin necesidad de que la
  // pantalla de carga sea "un paso" navegable.
  const STABLE_STEPS: FlowStep[] = ['idle', 'scan_overlay', 'reviewing_renders', 'final_kit'];
  const setStableStep = (next: FlowStep, options?: { replace?: boolean }) => {
    setStep(next);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('paso', next);
      return p;
    }, { replace: options?.replace ?? false });
  };

  // Al cargar con ?paso=X en la URL (recarga, o volver con "adelante" del
  // navegador), restaurar ese paso solo si además hay datos reales para
  // mostrarlo — si no, se ignora y queda "idle" (ver guarda más abajo).
  useEffect(() => {
    const stepFromUrl = searchParams.get('paso') as FlowStep | null;
    if (stepFromUrl && STABLE_STEPS.includes(stepFromUrl) && stepFromUrl !== step) {
      setStep(stepFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('paso')]);

  // Guarda: si el paso restaurado desde la URL no es alcanzable con lo que
  // hay en memoria (recarga a mitad del wizard, o un link directo a
  // ?paso=reviewing_renders sin haber subido ninguna foto), vuelve a "idle"
  // en vez de mostrar una pantalla a medias.
  useEffect(() => {
    if (searchParams.get('session')) return;
    const reachable =
      step === 'idle' ? true :
      step === 'scan_overlay' ? !!currentKit :
      step === 'reviewing_renders' ? !!currentKit && currentKit.items.some(i => i.status === 'done' || i.status === 'error') :
      step === 'final_kit' ? !!currentKit?.finalKitUrl :
      true; // estados de carga: no aplica la guarda
    if (!reachable) setStableStep('idle', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Retomar sesión desde notificación
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam || !user) return;
    let cancelled = false;
    (async () => {
      const notif = await getNotification(user.uid, sessionParam);
      if (cancelled || !notif) { setSearchParams({}, { replace: true }); return; }
      const imgs = notif.shots
        .filter(s => s.status === 'completed' && s.imageUrl)
        .sort((a, b) => a.index - b.index)
        .map(s => s.imageUrl!);
      if (imgs.length > 0) {
        setLightboxImages(imgs);
        setLightboxIndex(0);
        setLightboxMetadata({ label: notif.moduleLabel });
        setLightboxOpen(true);
      }
      setSearchParams({}, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => { loadLibrary(); }, []);

  const loadLibrary = async () => {
    const [kits, items, combos] = await Promise.all([
      outfitStorage.listKits(),
      outfitStorage.listItems(),
      outfitStorage.listCombinations(),
    ]);
    setLibraryKits(kits);
    setLibraryItems(items);
    setLibraryCombinations(combos);
  };

  // ── Handlers de biblioteca ────────────────────────────────────────────────

  const handleDeleteKit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este kit permanentemente?')) {
      await outfitStorage.deleteKit(id);
      await loadLibrary();
    }
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar esta prenda de la biblioteca?')) {
      await outfitStorage.deleteItem(id);
      await loadLibrary();
    }
  };

  const handleDeleteCombination = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este outfit set?')) {
      await outfitStorage.deleteCombination(id);
      await loadLibrary();
    }
  };

  // ── Lógica de flujo ───────────────────────────────────────────────────────

  const startDetection = async () => {
    if (!sourceImage) return;
    setStep('detecting');
    setItemsAlreadySaved(false);
    setLoadingMsg('Buscando las prendas de tu foto...');
    try {
      const result = await outfitService.analyzeOutfit(sourceImage);
      if (!result.items || result.items.length === 0) {
        alert('No encontramos prendas claras. Asegúrate de que la foto muestre el look completo.');
        setStableStep('idle', { replace: true });
        return;
      }
      setCurrentKit(result);
      setStableStep('scan_overlay');
    } catch (e: any) {
      alert('No pudimos separar las prendas. Prueba con otra foto.');
      setStableStep('idle', { replace: true });
    }
  };

  const toggleItemSelection = (id: string) => {
    if (!currentKit) return;
    setCurrentKit({
      ...currentKit,
      items: currentKit.items.map(item => item.id === id ? { ...item, selected: !item.selected } : item),
    });
  };

  const quickSelect = (mode: 'clothing' | 'clothing_footwear' | 'all' | 'none') => {
    if (!currentKit) return;
    setCurrentKit({
      ...currentKit,
      items: currentKit.items.map(item => {
        let selected = false;
        if (mode === 'all') selected = true;
        if (mode === 'clothing') selected = ['main_garment', 'top', 'bottom', 'bag', 'accessory'].includes(item.category);
        if (mode === 'clothing_footwear') selected = ['main_garment', 'top', 'bottom', 'footwear', 'bag', 'accessory'].includes(item.category);
        return { ...item, selected };
      }),
    });
  };

  const commitRenderItems = (kit: OutfitKit, items: OutfitItem[]) => {
    setCurrentKit(prev => {
      const baseKit = prev && prev.id === kit.id ? prev : kit;
      return { ...baseKit, items: [...items] };
    });
  };

  const generateItemRenderWithRetries = async (
    item: OutfitItem,
    kit: OutfitKit,
    shotIndex: number,
    totalShots: number,
    sessionId: string,
  ) => {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
      item.renderAttempts = attempt;
      item.lastError = null;
      setLoadingMsg(`Generando ${item.name}...`);

      try {
        const url = await outfitService.generateItemRender(
          item, kit.originalImage, modelId,
          {
            uid: user?.uid,
            sessionId,
            module: 'outfit',
            moduleLabel: 'Extraer prendas',
            shotIndex,
            totalShots,
            metadata: {
              kitId: kit.id,
              itemId: item.id,
              itemName: item.name,
              attempt,
              totalItems: totalShots,
            },
          },
        );

        item.imageUrl = url;
        item.status = 'done';
        item.lastError = null;
        generationHistoryService.save({
          imageUrl: url,
          module: 'outfit_extractor',
          moduleLabel: `Separar prendas (${item.name})`,
          creditsUsed: outfitCostPerItem,
          promptText: `Render for ${item.name}`,
        }).catch(console.error);
        return;
      } catch (err) {
        lastError = err;
        const appError = parseErrorCode(err);
        item.lastError = appError.message;

        const canRetry = attempt < MAX_RENDER_ATTEMPTS && shouldRetryRenderError(err);
        if (!canRetry) break;

        const delay = RENDER_RETRY_DELAYS_MS[attempt - 1] ?? RENDER_ITEM_DELAY_MS;
        setLoadingMsg(`Seguimos preparando ${item.name}...`);
        await sleep(delay);
      }
    }

    const appError = parseErrorCode(lastError);
    item.status = 'error';
    item.lastError = appError.message;
  };

  const renderQueuedItems = async (
    kit: OutfitKit,
    itemIds: string[],
    options: { initialDelayMs?: number; lockAlreadyHeld?: boolean } = {},
  ) => {
    if (renderQueueRunningRef.current && !options.lockAlreadyHeld) return;
    if (!options.lockAlreadyHeld) renderQueueRunningRef.current = true;

    try {
      setStep('generating_renders');
      const idsToRender = new Set(itemIds);
      const updatedItems = kit.items.map(item => idsToRender.has(item.id)
        ? {
          ...item,
          status: 'pending' as const,
          imageUrl: item.status === 'done' ? item.imageUrl : null,
          lastError: null,
          renderAttempts: 0,
          selected: true,
        }
        : { ...item },
      );
      commitRenderItems(kit, updatedItems);

      const renderItems = updatedItems.filter(item => idsToRender.has(item.id));
      const totalToRender = renderItems.length;
      const sessionId = newSessionId();

      if (options.initialDelayMs && options.initialDelayMs > 0) {
        setLoadingMsg('Preparando tus renders...');
        await sleep(options.initialDelayMs);
      }

      for (let itemIndex = 0; itemIndex < renderItems.length; itemIndex++) {
        const item = renderItems[itemIndex];

        setLoadingMsg(`Generando ${item.name}...`);
        item.status = 'generating';
        item.lastError = null;
        commitRenderItems(kit, updatedItems);

        await generateItemRenderWithRetries(item, kit, itemIndex, totalToRender, sessionId);
        commitRenderItems(kit, updatedItems);

        const hasMoreItems = itemIndex < renderItems.length - 1;
        if (hasMoreItems) {
          setLoadingMsg('Seguimos preparando tus renders...');
          await sleep(RENDER_ITEM_DELAY_MS);
        }
      }
    } finally {
      if (!options.lockAlreadyHeld) renderQueueRunningRef.current = false;
      setStableStep('reviewing_renders', { replace: true });
      setLoadingMsg('');
    }
  };

  const confirmSelectionAndRender = async () => {
    if (!currentKit || renderQueueRunningRef.current) return;
    const selectedItems = currentKit.items.filter(i => i.selected);
    if (selectedItems.length === 0) return alert('Selecciona al menos una prenda para crear la foto.');

    renderQueueRunningRef.current = true;
    try {
      const ok = await checkAndDeduct(selectedItems.length * outfitCostPerItem);
      if (!ok) return;

      await renderQueuedItems(currentKit, selectedItems.map(item => item.id), { lockAlreadyHeld: true });
    } finally {
      renderQueueRunningRef.current = false;
    }
  };

  const retryErroredRenders = async (itemId?: string) => {
    if (!currentKit || renderQueueRunningRef.current) return;
    const retryIds = currentKit.items
      .filter(item => item.status === 'error' && (!itemId || item.id === itemId))
      .map(item => item.id);
    if (retryIds.length === 0) return;
    await renderQueuedItems(currentKit, retryIds, { initialDelayMs: RENDER_ITEM_DELAY_MS });
  };

  const composeFinalKit = async () => {
    if (!currentKit) return;
    const ok = await checkAndDeduct(outfitCostPerItem);
    if (!ok) return;
    setStep('composing');
    setLoadingMsg('Uniendo las prendas en una sola imagen...');
    try {
      const finalUrl = await outfitService.generateFinalComposition(currentKit, modelId, {
        uid: user?.uid,
        sessionId: newSessionId(),
        module: 'outfit',
        moduleLabel: 'Outfit (Kit final)',
        shotIndex: 0,
        totalShots: 1,
      });
      generationHistoryService.save({
        imageUrl: finalUrl,
        module: 'outfit_extractor',
        moduleLabel: 'Separar prendas (imagen final)',
        creditsUsed: outfitCostPerItem,
        promptText: 'Final composition',
      }).catch(console.error);

      const finalizedKit = { ...currentKit, finalKitUrl: finalUrl };
      // Si el usuario ya guardó las prendas a mano ("Guardar prendas"), no
      // volver a crearlas — solo guardar el kit con la imagen final.
      const itemsToSave: SavedOutfitItem[] = itemsAlreadySaved ? [] : currentKit.items
        .filter(it => it.status === 'done' && it.imageUrl)
        .map(it => ({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          kitId: finalizedKit.id,
          name: it.name,
          category: it.category,
          description: it.description,
          visualDescription: it.visualDescription,
          layerMetadata: it.layerMetadata,
          imageUrl: it.imageUrl!,
          createdAt: Date.now(),
        }));

      await Promise.all([outfitStorage.saveKit(finalizedKit), outfitStorage.saveItems(itemsToSave)]);
      setCurrentKit(finalizedKit);
      await loadLibrary();
      setStableStep('final_kit', { replace: true });
    } catch (e: any) {
      alert('No pudimos preparar las prendas seleccionadas. Inténtalo de nuevo.');
      setStableStep('reviewing_renders', { replace: true });
    }
  };

  // Guarda solo las prendas individuales en la biblioteca, sin generar la imagen de kit final.
  // No cuesta créditos adicionales.
  const saveItemsOnly = async () => {
    if (!currentKit) return;
    const itemsToSave: SavedOutfitItem[] = currentKit.items
      .filter(it => it.status === 'done' && it.imageUrl)
      .map(it => ({
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        kitId: currentKit.id,
        name: it.name,
        category: it.category,
        description: it.description,
        visualDescription: it.visualDescription,
        layerMetadata: it.layerMetadata,
        imageUrl: it.imageUrl!,
        createdAt: Date.now(),
      }));
    if (itemsToSave.length === 0) return;
    await outfitStorage.saveItems(itemsToSave);
    await loadLibrary();
    setItemsAlreadySaved(true);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const downloadAll = async (kit: OutfitKit | null = currentKit) => {
    if (!kit) return;
    setIsZipping(true);
    const imgs: string[] = [];
    if (kit.finalKitUrl) imgs.push(kit.finalKitUrl);
    kit.items.forEach(item => { if (item.imageUrl && item.selected) imgs.push(item.imageUrl); });
    if (imgs.length > 0) await downloadAsZip(imgs, `Outfit_Kit_LuzIA_${kit.id.slice(-4)}.zip`, 'outfit');
    setIsZipping(false);
  };

  const reset = () => {
    setMainView('main');
    setStableStep('idle', { replace: true });
    setSourceImage(null);
    setCurrentKit(null);
    setCurrentCombo(null);
    setItemsAlreadySaved(false);
  };

  const viewFromLibrary = (kit: OutfitKit) => {
    setCurrentKit(kit);
    setStableStep('final_kit', { replace: true });
    setMainView('main');
    // Un kit cargado desde la biblioteca ya tiene sus prendas guardadas.
    setItemsAlreadySaved(true);
  };

  const openLightbox = (images: string[], initialIndex = 0, label = '') => {
    setLightboxImages(images);
    setLightboxIndex(initialIndex);
    setLightboxMetadata({ label });
    setLightboxOpen(true);
  };

  // Mezclador
  const canAddLayer = (category: string) => {
    const count = creatorSelectedItems.filter(i => i.category === category).length;
    if (category === 'top') return count < 3;
    if (category === 'bottom') return count < 3;
    if (category === 'footwear') return count < 1;
    if (category === 'accessory') return count < 6;
    if (category === 'main_garment') return count < 1;
    if (category === 'bag') return count < 1;
    return false;
  };

  const toggleCreatorItem = (item: SavedOutfitItem) => {
    const isSelected = creatorSelectedItems.some(i => i.id === item.id);
    if (isSelected) {
      setCreatorSelectedItems(creatorSelectedItems.filter(i => i.id !== item.id));
    } else {
      if (canAddLayer(item.category)) {
        setCreatorSelectedItems([...creatorSelectedItems, item]);
      } else {
        alert(`Llegaste al límite de prendas para esta categoría.`);
      }
    }
  };

  const generateCombinedOutfit = async () => {
    if (creatorSelectedItems.length === 0) return;
    const ok = await checkAndDeduct(outfitCostPerItem);
    if (!ok) return;
    setStep('composing');
    setLoadingMsg('Combinando prendas...');
    try {
      const finalUrl = await outfitService.generateCombinationComposition(creatorSelectedItems, modelId, {
        uid: user?.uid,
        sessionId: newSessionId(),
        module: 'outfit',
        moduleLabel: 'Outfit (Combinación)',
        shotIndex: 0,
        totalShots: 1,
      });
      const newCombo: OutfitCombination = {
        id: `combo_${Date.now()}`,
        name: creatorName || 'Sin nombre',
        items: creatorSelectedItems,
        finalImageUrl: finalUrl,
        createdAt: Date.now(),
      };
      await outfitStorage.saveCombination(newCombo);
      setCurrentCombo(newCombo);
      await loadLibrary();
      setMainView('library');
      setLibView('combinations');
      setStep('idle');
      setCreatorSelectedItems([]);
    } catch (e: any) {
      alert('No pudimos crear la imagen. Inténtalo de nuevo.');
      setStep('idle');
    }
  };

  const categorizedItems = useMemo<Record<string, SavedOutfitItem[]>>(() => {
    const cats = ['top', 'bottom', 'footwear', 'accessory', 'bag', 'main_garment'];
    return cats.reduce((acc, cat) => {
      acc[cat] = libraryItems.filter(i => i.category === cat);
      return acc;
    }, {} as Record<string, SavedOutfitItem[]>);
  }, [libraryItems]);

  // ── Cálculos de costo ─────────────────────────────────────────────────────
  // Con GPT Image 2: 1 crédito por todo (renders + kit final + combinaciones)
  // Con Gemini/Seedream: usa OUTFIT_PER_GARMENT (2 créditos)
  const outfitCostPerItem   = modelId === 'gptimage' ? 1 : CREDIT_COSTS.OUTFIT_PER_GARMENT;

  const selectedItemsCount  = currentKit?.items.filter(i => i.selected).length || 0;
  const failedSelectedCount = currentKit?.items.filter(i => i.selected && i.status === 'error').length || 0;
  const doneSelectedCount   = currentKit?.items.filter(i => i.selected && i.status === 'done').length || 0;
  const renderCost          = selectedItemsCount * outfitCostPerItem;
  const creditsAfterRender  = Math.max(0, credits.available - renderCost);
  const comboCost           = outfitCostPerItem;
  const creditsAfterCombo   = Math.max(0, credits.available - comboCost);

  // Estados de carga activa
  const isLoading = step === 'detecting' || step === 'generating_renders' || step === 'composing';

  // Pasos narrados durante la carga — calculados fuera del JSX para evitar narrowing de TypeScript
  const loadingProgressSteps = [
    { label: 'Analizando la foto',          done: step !== 'detecting', active: step === 'detecting' },
    { label: 'Creando la foto de cada prenda', done: step === 'composing', active: step === 'generating_renders' },
    { label: 'Uniendo las prendas',            done: false,                active: step === 'composing' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />

      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 animate-in fade-in">

        {/* ── Header: una sola fila también en mobile ───────────────────── */}
        <header className="flex items-center justify-between gap-3 px-1 mb-2">
          <div>
            <h1 className="t-display text-[13px] md:text-3xl text-slate-900 leading-none">Extraer <span className="text-brand-600">prendas</span></h1>
            <div className="hidden md:flex items-center gap-2 mt-2">
              <p className="text-slate-500 font-medium italic text-xs md:text-sm">
                Separa cada prenda de una foto y crea una imagen limpia para tu catálogo.
              </p>
              <ModuleTutorial moduleId="outfitKit" steps={TUTORIAL_CONFIGS.outfitKit} />
            </div>
          </div>
          <div className="flex bg-white p-1 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 gap-0 flex-shrink-0">
            <button
              onClick={() => { setMainView('main'); if (step === 'library' as any) setStep('idle'); }}
              className={`px-3.5 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl t-meta transition-colors duration-150 ${mainView === 'main' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}
            >
              Extraer
            </button>
            <button
              onClick={() => setMainView('library')}
              className={`px-3.5 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl t-meta transition-colors duration-150 ${mainView === 'library' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}
            >
              Biblioteca
            </button>
          </div>
        </header>

        {/* ── Pantalla de carga: dos columnas al estilo Product Generator ── */}
        {isLoading && (
          <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden">
            <WizardStepper steps={OUTFIT_WIZARD_STEPS} current={3} onJump={undefined} />
            <div className="p-4 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
                {/* Izquierda: estado narrado */}
                <div className="md:col-span-5 lg:col-span-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">
                      {step === 'detecting' ? 'Analizando · no cierres esta ventana' : 'Generando · no cierres esta ventana'}
                    </span>
                  </div>
                  <h2 className="t-display text-[24px] md:text-[28px] text-slate-900 leading-tight">
                    {step === 'detecting' ? 'Buscando prendas' : step === 'composing' ? 'Uniendo las prendas' : 'Creando fotos'}
                  </h2>
                  <div className="text-[13px] text-slate-500 mt-1 mb-4">
                    {step === 'detecting'
                      ? 'Analizando la imagen...'
                      : step === 'generating_renders'
                      ? `${selectedItemsCount} ${selectedItemsCount === 1 ? 'prenda' : 'prendas'} seleccionadas`
                      : 'Composición final'}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px] space-y-3">
                    {loadingProgressSteps.map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-emerald-500' : s.active ? 'bg-brand-500' : 'bg-slate-100'}`}>
                          {s.done
                            ? <i className="fa-solid fa-check text-white text-[9px]" />
                            : s.active
                            ? <i className="fa-solid fa-spinner animate-spin text-white text-[9px]" />
                            : null}
                        </div>
                        <span className={`text-[13px] leading-[1.4] ${s.active ? 'font-semibold text-slate-900' : s.done ? 'text-slate-700' : 'text-slate-400'}`}>
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  {loadingMsg && (
                    <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
                      {loadingMsg}
                    </div>
                  )}
                  <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5] flex items-start gap-2">
                    <i className="fa-solid fa-circle-info text-brand-500 mt-0.5"></i>
                    <span>Puedes cerrar la ventana. Te avisaremos cuando termine.</span>
                  </div>
                </div>

                {/* Derecha: grilla de tarjetas en vivo */}
                <div className="md:col-span-7 lg:col-span-8">
                  <div className="mb-3.5">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-1">En vivo</div>
                    <h3 className="t-display text-[20px] md:text-[22px] text-slate-900 normal-case italic">
                      {step === 'detecting'
                        ? 'Detectando...'
                        : `${currentKit?.items.filter(i => i.status === 'done').length || 0} de ${selectedItemsCount} listas`}
                    </h3>
                  </div>
                  {step === 'detecting' ? (
                    <div className="relative aspect-[3/4] max-w-xs rounded-2xl overflow-hidden border-2 border-brand-500 bg-slate-100 animate-pulse">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">Analizando</div>
                      </div>
                    </div>
                  ) : (
                    <div className={`grid gap-3 ${selectedItemsCount <= 2 ? 'grid-cols-2' : selectedItemsCount <= 4 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                      {currentKit?.items.filter(i => i.selected).map((item, i) => {
                        const done = item.status === 'done';
                        const doing = item.status === 'generating';
                        return (
                          <div key={item.id} className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all ${done ? 'shadow-md' : doing ? 'border-2 border-brand-500 bg-slate-100 animate-pulse' : 'bg-slate-100'}`}>
                            {done && item.imageUrl ? (
                              <>
                                <img src={item.imageUrl} className="w-full h-full object-contain bg-slate-50" />
                                <div className="absolute top-2 right-2 bg-white/95 text-slate-900 text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 rounded">{i + 1}</div>
                              </>
                            ) : doing ? (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">EN VIVO</div>
                              </div>
                            ) : (
                              <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-semibold">{i + 1}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Vista principal (flujo de extracción) ────────────────────── */}
        {mainView === 'main' && !isLoading && (

          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 md:px-0`}>

            {/* Columna izquierda: wizard */}
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white rounded-2xl md:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <WizardStepper
                  steps={OUTFIT_WIZARD_STEPS}
                  current={flowToWizardStep(step)}
                  onJump={undefined}
                />

                <div className="p-4 md:p-8 flex-1 overflow-auto">

                  {/* PASO 1: subir foto */}
                  {step === 'idle' && (
                    <div className="space-y-3 md:space-y-6 animate-in slide-in-from-left-4">
                      <StepHeader title="Sube tu foto" subtitle="Usa una foto donde se vea el look completo" icon="fa-camera" />
                      <ImageSlot
                        value={sourceImage}
                        onChange={setSourceImage}
                        label="Foto de referencia"
                        hint="JPG o PNG · cuerpo completo"
                        aspectRatio="portrait"
                      />
                      <UploadDisclaimer />
                      <ModelSelector
                        value={modelId}
                        onChange={setModelId}
                        disabled={isLoading}
                        exclude={['seedream']}
                      />
                    </div>
                  )}

                  {/* PASO 2: seleccionar prendas */}
                  {step === 'scan_overlay' && currentKit && (
                    <div className="space-y-4 md:space-y-5 animate-in slide-in-from-left-4">
                      <StepHeader title="Elige las prendas" subtitle="Selecciona cuáles quieres separar" icon="fa-shirt" />

                      {/* Mobile: tab para elegir entre ver la foto con marcadores o la lista —
                          en desktop ambas conviven (lista acá, foto en la columna derecha) */}
                      <div className="md:hidden flex gap-0.5 bg-brand-50 border border-brand-100 rounded-2xl p-1">
                        <button
                          onClick={() => setMobileScanTab('photo')}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${mobileScanTab === 'photo' ? 'bg-white text-brand-600 shadow-sm' : 'text-brand-600/55'}`}
                        >
                          <i className="fa-solid fa-camera text-[10px]" /> Foto
                        </button>
                        <button
                          onClick={() => setMobileScanTab('list')}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${mobileScanTab === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-brand-600/55'}`}
                        >
                          <i className="fa-solid fa-list text-[10px]" /> Lista
                        </button>
                      </div>

                      <div className={`md:hidden ${mobileScanTab === 'photo' ? '' : 'hidden'}`}>
                        <ScanOverlay kit={currentKit} onToggle={toggleItemSelection} />
                        <p className="mt-3 text-[10px] text-slate-400 text-center leading-relaxed">Tocá una etiqueta sobre la foto para incluir o quitar esa prenda.</p>
                      </div>

                      <div className={mobileScanTab === 'list' ? '' : 'hidden md:block'}>
                        {/* Botones de selección rápida */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <button onClick={() => quickSelect('clothing')} className="py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-600 active:scale-95 transition-all">Solo ropa</button>
                          <button onClick={() => quickSelect('clothing_footwear')} className="py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-600 active:scale-95 transition-all">Ropa + calzado</button>
                          <button onClick={() => quickSelect('all')} className="py-3 bg-brand-50 border border-brand-100 rounded-xl text-[10px] font-black uppercase text-brand-600 active:scale-95 transition-all">Todas</button>
                          <button onClick={() => quickSelect('none')} className="py-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black uppercase text-red-600 active:scale-95 transition-all">Ninguna</button>
                        </div>

                        {/* Lista de prendas */}
                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                          {currentKit.items.map(item => (
                            <div
                              key={item.id}
                              onClick={() => toggleItemSelection(item.id)}
                              className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer ${item.selected ? 'border-brand-600 bg-brand-50' : 'border-slate-100 bg-slate-50 opacity-50'}`}
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.selected ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <i className={`fa-solid text-sm ${item.category === 'footwear' ? 'fa-shoe-prints' : item.category === 'bag' ? 'fa-bag-shopping' : 'fa-shirt'}`} />
                              </div>
                              <p className="text-[11px] font-black text-slate-900 uppercase truncate flex-1">{item.name}</p>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200'}`}>
                                {item.selected && <i className="fa-solid fa-check text-[9px]" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Panel de costo — tira compacta en mobile, bloque completo en desktop */}
                      {selectedItemsCount > 0 && (
                        <>
                          <div className="md:hidden flex items-center bg-slate-50 border border-slate-200 rounded-2xl py-2.5">
                            <div className="flex-1 flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Prendas</span>
                              <span className="text-[13px] font-bold text-slate-900">{selectedItemsCount}</span>
                            </div>
                            <div className="w-px h-6 bg-slate-200" />
                            <div className="flex-1 flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Costo</span>
                              <span className="text-[13px] font-bold text-brand-600">{renderCost} cr</span>
                            </div>
                            <div className="w-px h-6 bg-slate-200" />
                            <div className="flex-1 flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Kit final</span>
                              <span className="text-[13px] font-bold text-slate-900">+{outfitCostPerItem} cr</span>
                            </div>
                          </div>

                          <div className="hidden md:block relative bg-slate-900 text-white rounded-2xl p-4 overflow-hidden">
                            <div className="absolute -top-8 -right-8 w-[120px] h-[120px] rounded-full pointer-events-none" style={{ background: 'rgba(247,44,91,0.3)', filter: 'blur(36px)' }} />
                            <div className="relative">
                              <div className="text-[10px] font-bold text-brand-300 uppercase tracking-[0.14em] mb-3">
                                Resumen del costo
                              </div>
                              <div className="flex flex-col gap-1.5 mb-3 text-[12px]">
                                <div className="flex justify-between">
                                  <span className="opacity-70">{selectedItemsCount} {selectedItemsCount === 1 ? 'prenda' : 'prendas'} × {outfitCostPerItem} cr</span>
                                  <span className="font-semibold">{renderCost} cr</span>
                                </div>
                                <div className="flex justify-between opacity-60">
                                  <span>Kit final (imagen compuesta)</span>
                                  <span className="font-semibold">{outfitCostPerItem} cr (opcional)</span>
                                </div>
                                <div className="h-px bg-white/10 my-1" />
                                <div className="flex justify-between items-baseline">
                                  <span className="opacity-85">Solo renders</span>
                                  <span className="t-display text-[28px] tracking-tight leading-none normal-case not-italic">
                                    {renderCost}{' '}
                                    <span className="text-xs opacity-70 font-semibold normal-case">cr</span>
                                  </span>
                                </div>
                              </div>
                              <div className="text-[11px] leading-[1.5] opacity-70">
                                Te quedarán {creditsAfterRender} cr · La imagen final se cobra aparte si decides crearla.
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                    </div>
                  )}

                  {/* PASO 3: renders listos — selección para kit final */}
                  {step === 'reviewing_renders' && currentKit && (
                    <div className="space-y-4 animate-in slide-in-from-left-4">
                      <StepHeader title="Fotos listas" subtitle="Elige cuáles incluir en la imagen final" icon="fa-images" />

                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900">
                        <strong>{doneSelectedCount}</strong> de <strong>{selectedItemsCount}</strong> prendas listas. Tocá una para incluirla o quitarla del kit.
                      </div>

                      {failedSelectedCount > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-2">
                          <p>
                            <strong>{failedSelectedCount}</strong> {failedSelectedCount === 1 ? 'prenda quedó pendiente' : 'prendas quedaron pendientes'}.
                          </p>
                          <button
                            type="button"
                            onClick={() => retryErroredRenders()}
                            className="w-full py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                          >
                            <i className="fa-solid fa-rotate-right" />
                            Reintentar
                          </button>
                        </div>
                      )}

                      {/* Lista de prendas con toggle de inclusión */}
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {currentKit.items.filter(i => i.status === 'done' || i.status === 'error').map(item => (
                          <div
                            key={item.id}
                            onClick={() => item.status === 'done' && toggleItemSelection(item.id)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                              item.status === 'error'
                                ? 'border-red-100 bg-red-50 opacity-60 cursor-not-allowed'
                                : item.selected
                                ? 'border-brand-600 bg-brand-50 cursor-pointer'
                                : 'border-slate-100 bg-slate-50 opacity-50 cursor-pointer'
                            }`}
                          >
                            {/* Miniatura */}
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                              {item.imageUrl
                                ? <img src={item.imageUrl} className="w-full h-full object-contain" />
                                : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-xmark text-red-400 text-xs" /></div>}
                            </div>
                            <p className="text-[11px] font-black text-slate-900 uppercase truncate flex-1">{item.name}</p>
                            {item.status === 'error'
                              ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); retryErroredRenders(item.id); }}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5"
                                  title="Reintentar render"
                                >
                                  <i className="fa-solid fa-rotate-right" />
                                  Reintentar
                                </button>
                              )
                              : (
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200'}`}>
                                  {item.selected && <i className="fa-solid fa-check text-[9px]" />}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>

                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Al componer el kit, las prendas seleccionadas se guardan automáticamente en tu Biblioteca.
                      </p>
                    </div>
                  )}

                  {/* PASO 4: kit final */}
                  {step === 'final_kit' && currentKit && (
                    <div className="space-y-5 animate-in slide-in-from-left-4">
                      <StepHeader title="Imagen lista" subtitle="Tu catálogo de prendas está listo" icon="fa-check-circle" />
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-[12px] text-emerald-900">
                        Tu imagen fue guardada en la <strong>Biblioteca</strong>. Puedes descargarla o empezar otra foto.
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer de navegación */}
                {step === 'idle' && (
                  <WizardFooter
                    onContinue={startDetection}
                    continueLabel="Buscar prendas"
                    disabled={!sourceImage}
                  />
                )}
                {step === 'scan_overlay' && (
                  <WizardFooter
                    onBack={() => { setStableStep('idle'); setCurrentKit(null); }}
                    onContinue={confirmSelectionAndRender}
                    continueLabel={`Generar ${selectedItemsCount > 0 ? `(${selectedItemsCount})` : ''}`}
                    disabled={selectedItemsCount === 0}
                    costInfo={selectedItemsCount > 0 ? { cost: renderCost, label: 'Costo total' } : undefined}
                  />
                )}
                {step === 'reviewing_renders' && (
                  <div
                    className="sticky bottom-0 z-10 bg-white border-t border-slate-200 px-4 py-3 flex flex-col gap-2"
                    style={{ boxShadow: '0 -8px 24px rgba(15,23,42,0.04)' }}
                  >
                    {savedMsg ? (
                      <div className="w-full py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-2">
                        <i className="fa-solid fa-check text-emerald-500" />
                        Prendas guardadas en biblioteca
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {/* Opción 1: solo guardar prendas, sin kit */}
                        <button
                          type="button"
                          onClick={saveItemsOnly}
                          disabled={currentKit?.items.filter(i => i.status === 'done').length === 0}
                          style={{ touchAction: 'manipulation' }}
                          className="flex-1 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-floppy-disk text-slate-400" />
                          <span className="hidden sm:inline">Guardar</span>
                        </button>
                        {/* Opción 2: generar imagen compuesta + guardar todo */}
                        <button
                          type="button"
                          onClick={composeFinalKit}
                          disabled={currentKit?.items.filter(i => i.selected && i.status === 'done').length === 0}
                          style={{ touchAction: 'manipulation' }}
                          className="flex-[1.3] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_12px_28px_rgba(247,44,91,0.32)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                          Crear final · {outfitCostPerItem} cr
                          <i className="fa-solid fa-arrow-right text-sm" />
                        </button>
                      </div>
                    )}
                    <p className="text-center text-[9px] text-slate-400">
                      Crea una imagen con todas las prendas juntas
                    </p>
                  </div>
                )}
                {step === 'final_kit' && (
                  <WizardFooter
                    onContinue={reset}
                    continueLabel="Nueva producción"
                    secondaryAction={{
                      label: 'Descargar ZIP',
                      icon: <i className="fa-solid fa-file-zipper text-sm" />,
                      onClick: () => downloadAll(),
                    }}
                  />
                )}

              </section>
            </div>

            {/* Columna derecha: vista previa / resultados.
                "idle" y "scan_overlay" son solo desktop (en mobile ya se ven
                completos en la columna izquierda: tarjeta de subida, tab
                Foto/Lista) — "reviewing_renders" y "final_kit" sí tienen
                contenido único que también se muestra en mobile. */}
            <div className="lg:col-span-8">

              {/* Estado idle: placeholder oscuro — solo desktop */}
              {step === 'idle' && (
                <div className="hidden lg:flex bg-slate-900 rounded-[48px] p-8 md:p-12 min-h-[500px] flex-col items-center justify-center shadow-2xl border-8 border-slate-800 text-center space-y-6">
                  <i className="fa-solid fa-shirt text-white/5 text-8xl" />
                  <div>
                    <h3 className="text-white text-2xl font-black uppercase italic tracking-tighter">Extractor de prendas</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-2 max-w-xs mx-auto leading-relaxed">
                      Subí una foto y detectamos cada prenda automáticamente
                    </p>
                  </div>
                </div>
              )}

              {/* Scan overlay: imagen original con marcadores — solo desktop */}
              {step === 'scan_overlay' && currentKit && (
                <div className="hidden lg:block bg-slate-900 rounded-[48px] p-4 md:p-6 min-h-[500px] shadow-2xl border-8 border-slate-800 relative overflow-hidden">
                  <ScanOverlay kit={currentKit} onToggle={toggleItemSelection} />
                </div>
              )}

              {/* Reviewing renders: grilla de prendas con toggle de selección */}
              {step === 'reviewing_renders' && currentKit && (
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em]">Tocá para incluir / quitar</div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {currentKit.items.filter(i => i.selected && i.status === 'done').length} seleccionadas
                    </div>
                  </div>
                  <div className={`grid gap-4 ${selectedItemsCount <= 4 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                    {currentKit.items.filter(i => i.status === 'done' || i.status === 'error').map(item => (
                      <div
                        key={item.id}
                        onClick={() => item.status === 'done' && toggleItemSelection(item.id)}
                        className={`bg-white p-3 rounded-[28px] border-4 shadow-sm space-y-3 group transition-all ${
                          item.status === 'error'
                            ? 'border-red-100 cursor-default'
                            : item.selected
                            ? 'border-brand-600 cursor-pointer'
                            : 'border-slate-100 opacity-60 cursor-pointer hover:opacity-80'
                        }`}
                      >
                        <div className="aspect-[3/4] bg-slate-50 rounded-[20px] overflow-hidden relative">
                          {item.imageUrl
                            ? <img src={item.imageUrl} className="w-full h-full object-contain" />
                            : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-xmark text-red-300 text-2xl" /></div>}
                          {/* Checkmark de selección */}
                          {item.selected && item.status === 'done' && (
                            <div className="absolute top-2 right-2 w-7 h-7 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg">
                              <i className="fa-solid fa-check text-[10px]" />
                            </div>
                          )}
                          {/* Botón de expandir (sin propagar el toggle) */}
                          {item.imageUrl && (
                            <div
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              onClick={e => { e.stopPropagation(); openLightbox([item.imageUrl!], 0, item.name); }}
                            >
                              <i className="fa-solid fa-expand text-white text-lg" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] font-black text-slate-900 uppercase truncate text-center px-1">{item.name}</p>
                        {item.status === 'error' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); retryErroredRenders(item.id); }}
                            className="w-full py-2 rounded-xl bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                            title="Reintentar render"
                          >
                            <i className="fa-solid fa-rotate-right" />
                            Reintentar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kit final */}
              {step === 'final_kit' && currentKit && (
                <div className="bg-white p-5 md:p-12 rounded-2xl md:rounded-[48px] border border-slate-100 shadow-lg text-center space-y-5 md:space-y-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Imagen lista</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Guardado en tu biblioteca</p>
                  </div>
                  <div
                    className="max-w-sm mx-auto aspect-[3/4] bg-slate-50 rounded-[40px] overflow-hidden shadow-xl relative group border-8 border-white cursor-pointer"
                    onClick={() => currentKit.finalKitUrl && openLightbox([currentKit.finalKitUrl], 0, 'Kit Final')}
                  >
                    {currentKit.finalKitUrl
                      ? <img src={currentKit.finalKitUrl} className="w-full h-full object-contain" />
                      : <div className="h-full flex items-center justify-center"><i className="fa-solid fa-spinner animate-spin text-3xl text-brand-500" /></div>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <i className="fa-solid fa-expand text-white text-3xl" />
                    </div>
                  </div>
                  <button
                    onClick={() => downloadAll()}
                    disabled={isZipping}
                    className="px-10 py-4 bg-slate-900 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-3 mx-auto active:scale-95 transition-all"
                  >
                    {isZipping ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-file-zipper" />}
                    Descargar todo (.zip)
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── Biblioteca ───────────────────────────────────────────────── */}
        {mainView === 'library' && (
          <div className="space-y-5 md:space-y-8 px-4 md:px-0">
            <nav className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-full overflow-x-auto">
              {[
                { id: 'kits',         label: 'Imágenes', icon: 'fa-box' },
                { id: 'items',        label: 'Prendas',      icon: 'fa-shirt' },
                { id: 'combinations', label: 'Combos',icon: 'fa-user-tie' },
                { id: 'creator',      label: 'Crear mix',    icon: 'fa-plus' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setLibView(tab.id as LibraryView)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${libView === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <i className={`fa-solid ${tab.icon} text-[9px]`} />
                  {tab.label}
                </button>
              ))}
            </nav>

            {libView === 'kits' && (
              <ResultLibraryGrid
                stats={[
                  { label: 'Kits', value: libraryKits.length, sub: 'guardados' },
                  { label: 'Prendas', value: libraryKits.reduce((s, k) => s + (k.items?.length ?? 0), 0), sub: 'extraídas', color: 'text-brand-600' },
                ]}
                searchTexts={libraryKits.map(k => `kit ${k.id}`)}
                emptyTitle="Aún no tienes imágenes finales"
                emptyDescription="Separa las prendas de tu primera foto para verla aquí"
                columns={3}
              >
                {libraryKits.map(kit => (
                  <ResultCard
                    key={kit.id}
                    images={[kit.finalKitUrl, ...(kit.items?.slice(0,2).map(i => i.imageUrl) ?? [])].filter(Boolean) as string[]}
                    title={`Kit #${kit.id.slice(-4)}`}
                    subtitle={kit.inputType === 'COLLAGE' ? 'Desde collage' : 'Desde foto real'}
                    date={kit.createdAt}
                    badge={{ label: `${kit.items?.length ?? 0} prendas`, color: 'fuchsia' }}
                    pills={kit.items?.slice(0, 3).map(i => i.category ?? i.name).filter(Boolean) ?? []}
                    accentColor="fuchsia"
                    onClick={() => viewFromLibrary(kit)}
                    actions={[
                      { label: 'Ver kit', onClick: e => { e.stopPropagation(); viewFromLibrary(kit); }, variant: 'primary' },
                      { label: '', icon: <i className="fa-solid fa-trash text-xs" />, onClick: e => handleDeleteKit(kit.id, e), variant: 'danger', title: 'Eliminar' },
                    ]}
                  />
                ))}
              </ResultLibraryGrid>
            )}

            {libView === 'items' && (
              <div className="space-y-6 md:space-y-10">
                {(Object.entries(categorizedItems) as [string, SavedOutfitItem[]][]).map(([cat, items]) =>
                  items.length > 0 && (
                    <section key={cat} className="space-y-3 md:space-y-4">
                      <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                        <span className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[9px] md:text-[10px]"><i className="fa-solid fa-tag" /></span>
                        {cat === 'top' ? 'Parte superior' : cat === 'bottom' ? 'Parte inferior' : cat === 'footwear' ? 'Calzado' : cat === 'accessory' ? 'Accesorios' : cat === 'bag' ? 'Bolsos' : 'Prendas completas'}
                        <span className="text-slate-400 not-italic ml-2 opacity-50">({items.length})</span>
                      </h4>
                      {/* Mobile: tira horizontal scrolleable — Desktop: grilla */}
                      <div className="flex md:grid md:grid-cols-6 gap-3 md:gap-4 overflow-x-auto md:overflow-visible pb-1">
                        {items.map(item => (
                          <div key={item.id} className="w-24 md:w-auto flex-shrink-0 bg-white p-2.5 md:p-3 rounded-2xl border border-slate-100 shadow-sm relative group">
                            <img src={item.imageUrl} className="aspect-[3/4] w-full object-contain bg-slate-50 rounded-xl cursor-pointer" onClick={() => openLightbox([item.imageUrl], 0, item.name)} />
                            <button onClick={e => handleDeleteItem(item.id, e)} className="absolute top-3.5 right-3.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <i className="fa-solid fa-trash text-[10px]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                )}
                {libraryItems.length === 0 && <div className="py-16 md:py-20 text-center bg-slate-50 rounded-2xl md:rounded-[40px] opacity-60 text-sm text-slate-400">Tu biblioteca de prendas está vacía</div>}
              </div>
            )}

            {libView === 'combinations' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8">
                {libraryCombinations.map(combo => (
                  <div key={combo.id} className="relative rounded-2xl md:rounded-[40px] overflow-hidden aspect-[3/4] shadow-sm md:shadow-lg border border-slate-100 group">
                    <div className="absolute inset-0 cursor-pointer" onClick={() => combo.finalImageUrl && openLightbox([combo.finalImageUrl], 0, combo.name)}>
                      <img src={combo.finalImageUrl || ''} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 md:p-5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
                      <h4 className="text-white text-[11px] md:text-lg font-black uppercase italic leading-tight">{combo.name}</h4>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        onClick={() => { const a = document.createElement('a'); a.href = combo.finalImageUrl!; a.download = `${combo.name}.png`; a.click(); }}
                        className="w-8 h-8 rounded-full bg-white/90 text-slate-900 flex items-center justify-center active:scale-95 transition-all"
                        aria-label="Descargar"
                      >
                        <i className="fa-solid fa-download text-[11px]" />
                      </button>
                      <button
                        onClick={e => handleDeleteCombination(combo.id, e)}
                        className="w-8 h-8 rounded-full bg-white/90 text-red-500 flex items-center justify-center active:scale-95 transition-all"
                        aria-label="Eliminar"
                      >
                        <i className="fa-solid fa-trash-can text-[11px]" />
                      </button>
                    </div>
                  </div>
                ))}
                {libraryCombinations.length === 0 && <div className="col-span-full py-16 md:py-20 text-center bg-slate-50 rounded-2xl md:rounded-[40px] opacity-60 text-sm text-slate-400">Aún no creaste combinaciones</div>}
              </div>
            )}

            {libView === 'creator' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8 items-start">
                <div className="lg:col-span-7 bg-white p-4 md:p-10 rounded-2xl md:rounded-[40px] border border-slate-100 shadow-sm space-y-5 md:space-y-10">
                  <div>
                    <h3 className="text-sm md:text-xl font-black text-slate-900 uppercase italic">Crear una combinación</h3>
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Combina prendas de distintas fotos</p>
                  </div>
                  <div className="space-y-5 md:space-y-10">
                    {['top', 'bottom', 'footwear', 'accessory'].map(cat => (
                      <section key={cat} className="space-y-3 md:space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase tracking-widest">
                            {cat === 'top' ? 'Parte superior (máx. 3)' : cat === 'bottom' ? 'Parte inferior (máx. 3)' : cat === 'footwear' ? 'Calzado (1)' : 'Accesorios (máx. 6)'}
                          </span>
                          <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{categorizedItems[cat]?.length || 0} disponibles</span>
                        </div>
                        <div className="flex gap-2.5 md:gap-3 overflow-x-auto pb-2 md:pb-4">
                          {categorizedItems[cat]?.map(item => {
                            const isSelected = creatorSelectedItems.some(i => i.id === item.id);
                            return (
                              <div key={item.id} onClick={() => toggleCreatorItem(item)} className={`flex-none w-20 md:w-24 aspect-[3/4] border-4 rounded-2xl overflow-hidden cursor-pointer transition-all relative ${isSelected ? 'border-brand-600 scale-105 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}>
                                <img src={item.imageUrl} className="w-full h-full object-contain bg-slate-50" />
                                {isSelected && <div className="absolute inset-0 bg-brand-600/20 flex items-center justify-center"><i className="fa-solid fa-check text-white text-xl" /></div>}
                              </div>
                            );
                          })}
                          {(!categorizedItems[cat] || categorizedItems[cat].length === 0) && (
                            <div className="h-20 md:h-24 flex items-center text-slate-300 text-[9px] md:text-[10px] font-black uppercase px-4 md:px-6 bg-slate-50 rounded-2xl border-2 border-dashed">Sin prendas en esta categoría</div>
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4 md:space-y-5 lg:sticky lg:top-24">
                  <div className="relative bg-slate-900 text-white rounded-2xl md:rounded-[32px] p-4 md:p-6 overflow-hidden shadow-2xl border-4 border-slate-800">
                    <div className="absolute -top-8 -right-8 w-[120px] h-[120px] rounded-full pointer-events-none" style={{ background: 'rgba(247,44,91,0.3)', filter: 'blur(36px)' }} />
                    <div className="relative space-y-5">
                      <h4 className="text-xl font-black uppercase italic tracking-tighter">Tu nuevo set</h4>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Nombre</label>
                        <input
                          type="text"
                          value={creatorName}
                          onChange={e => setCreatorName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold focus:border-brand-500 outline-none transition-all"
                          placeholder="Ej: Outfit casual verano"
                        />
                      </div>
                      {creatorSelectedItems.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {creatorSelectedItems.map(item => (
                            <div key={item.id} className="px-3 py-1.5 bg-white/10 rounded-full flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                              {item.name}
                              <button onClick={() => toggleCreatorItem(item)} className="ml-1 text-white/30 hover:text-white"><i className="fa-solid fa-xmark" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pt-4 border-t border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo</span>
                          <span className="t-display text-[28px] leading-none normal-case not-italic">
                            {comboCost} <span className="text-sm opacity-70 font-semibold">cr</span>
                          </span>
                        </div>
                        <GenerateButton
                          onClick={generateCombinedOutfit}
                          disabled={creatorSelectedItems.length === 0}
                          label="Crear combinación"
                          loadingLabel="Creando..."
                          imageCount={1}
                          creditsAfter={creditsAfterCombo}
                          className="w-full py-5 rounded-[20px] text-xs uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-[11px] text-emerald-900 leading-[1.55]">
                    <strong>Sin sorpresas.</strong> Solo se descuenta si la generación se completa.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lightbox */}
        {lightboxOpen && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onDownload={(url, idx) => {
              const a = document.createElement('a');
              a.href = url;
              a.download = `luzia_prenda_${idx + 1}.png`;
              a.click();
            }}
            metadata={lightboxMetadata}
          />
        )}

        {/* "Descargar ZIP" ahora vive como secondaryAction del WizardFooter de
            final_kit (ver arriba) — evita la barra flotante aparte que se
            superponía con la píldora de navegación, mismo fix que en
            Clone Image. */}

      </div>
    </>
  );
};

export default OutfitExtractorModule;
