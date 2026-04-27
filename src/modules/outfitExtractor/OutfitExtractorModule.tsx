// src/modules/outfitExtractor/OutfitExtractorModule.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { CREDIT_COSTS, MODEL_CREDIT_COST } from '../../services/creditConfig';
import { generationHistoryService } from '../../services/generationHistoryService';
import { outfitService } from './outfitService';
import { outfitStorage } from './outfitStorage';
import { OutfitKit, OutfitItem, SavedOutfitItem, OutfitCombination } from './types';
import { downloadAsZip } from '../../utils/imageUtils';
import { useAuth } from '../../modules/auth/AuthContext';
import { GenerateButton } from '../../components/shared/GenerateButton';
import { ModelSelector } from '../../components/shared/ModelSelector';
import { useModelSelection } from '../../hooks/useModelSelection';

// Nuevos componentes base
import { ImageSlot } from '../../components/shared/ImageSlot';
import UploadDisclaimer from '../../components/shared/UploadDisclaimer';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { FloatingActionBar } from '../../components/shared/FloatingActionBar';
import { useScrollFAB } from '../../hooks/useScrollFAB';

type Step = 'idle' | 'detecting' | 'scan_overlay' | 'generating_renders' | 'reviewing_renders' | 'composing' | 'final_kit' | 'library';
type LibraryView = 'kits' | 'items' | 'combinations' | 'creator';

const OutfitExtractorModule: React.FC = () => {
  const { credits } = useAuth();
  const { modelId, setModelId } = useModelSelection();
  const [step, setStep] = useState<Step>('idle');
  const [mainView, setMainView] = useState<'main' | 'library'>('main');
  const [libView, setLibView] = useState<LibraryView>('kits');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [currentKit, setCurrentKit] = useState<OutfitKit | null>(null);
  const [currentCombo, setCurrentCombo] = useState<OutfitCombination | null>(null);
  const [libraryKits, setLibraryKits] = useState<OutfitKit[]>([]);
  const [libraryItems, setLibraryItems] = useState<SavedOutfitItem[]>([]);
  const [libraryCombinations, setLibraryCombinations] = useState<OutfitCombination[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  const [creatorSelectedItems, setCreatorSelectedItems] = useState<SavedOutfitItem[]>([]);
  const [creatorName, setCreatorName] = useState('Nuevo Outfit Set');

  // Lightbox state (reemplaza selectedZoom)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });

  // FAB scroll detection
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();
  const containerRef = useRef<HTMLDivElement>(null);

  // Costo por prenda = CREDIT_COSTS.OUTFIT_PER_GARMENT (independiente del modelo)
  // El total se calcula en tiempo real según el número de prendas seleccionadas
  // El GenerateButton se usa en la fase de generación de renders. Para simplificar,
  // pasaremos el costo dinámico al botón dentro de confirmSelectionAndRender.
  // Pero como ConfirmSelectionAndRender no es un botón único (es un paso con varios),
  // vamos a modificar solo el botón de inicio de detección y el de "Generar Outfit Kit".
  // En este caso, el primer botón de "Analizar Outfit" no tiene costo (es gratis).
  // El segundo botón "Isolar Selección" sí tiene costo variable. Para ese, vamos a
  // calcular creditsAfter en ese momento y pasárselo al GenerateButton.
  // Pero el GenerateButton se usa en la UI para confirmSelectionAndRender,
  // y no está en el código actual, sino que es un botón normal. Lo reemplazaremos.

  // Calculamos créditos restantes después de la detección (gratis) y generación de renders:
  // El costo por render es CREDIT_COSTS.OUTFIT_PER_GARMENT por prenda seleccionada.
  // El botón "Isolar Selección" se encuentra en la fase 'scan_overlay'.
  // Vamos a modificar ese botón para que sea un GenerateButton con creditsAfter dinámico.
  // Pero el estado currentKit cambia, así que debemos calcular el costo en el render.

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    const [kits, items, combos] = await Promise.all([
      outfitStorage.listKits(),
      outfitStorage.listItems(),
      outfitStorage.listCombinations()
    ]);
    setLibraryKits(kits);
    setLibraryItems(items);
    setLibraryCombinations(combos);
  };

  const handleDeleteKit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar este kit permanentemente?")) {
      await outfitStorage.deleteKit(id);
      await loadLibrary();
    }
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar esta prenda de la biblioteca?")) {
      await outfitStorage.deleteItem(id);
      await loadLibrary();
    }
  };

  const handleDeleteCombination = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Eliminar este outfit set?")) {
      await outfitStorage.deleteCombination(id);
      await loadLibrary();
    }
  };

  const handleSourceImageChange = (base64: string | null) => {
    setSourceImage(base64);
  };

  const startDetection = async () => {
    if (!sourceImage) return;
    setStep('detecting');
    setLoadingMsg('Analizando prendas...');
    try {
      const result = await outfitService.analyzeOutfit(sourceImage);
      if (!result.items || result.items.length === 0) {
        alert("No se detectaron prendas en la imagen. Asegúrate de que la foto muestre claramente el outfit completo.");
        setStep('idle');
        return;
      }
      setCurrentKit(result);
      setStep('scan_overlay');
    } catch (e: any) {
      console.error('[OutfitKit] analyzeOutfit error:', e);
      alert("Error al analizar el outfit: " + e.message);
      setStep('idle');
    }
  };

  const toggleItemSelection = (id: string) => {
    if (!currentKit) return;
    setCurrentKit({
      ...currentKit,
      items: currentKit.items.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    });
  };

  const quickSelect = (mode: 'clothing' | 'clothing_footwear' | 'all' | 'none') => {
    if (!currentKit) return;
    setCurrentKit({
      ...currentKit,
      items: currentKit.items.map(item => {
        let selected = false;
        if (mode === 'all') selected = true;
        if (mode === 'none') selected = false;
        if (mode === 'clothing') selected = ['main_garment', 'top', 'bottom'].includes(item.category);
        if (mode === 'clothing_footwear') selected = ['main_garment', 'top', 'bottom', 'footwear'].includes(item.category);
        return { ...item, selected };
      })
    });
  };

  const confirmSelectionAndRender = async () => {
    if (!currentKit) return;
    const selectedItems = currentKit.items.filter(i => i.selected);
    if (selectedItems.length === 0) return alert("Selecciona al menos una prenda para procesar.");

    const ok = await checkAndDeduct(selectedItems.length * CREDIT_COSTS.OUTFIT_PER_GARMENT);
    if (!ok) return;

    setStep('generating_renders');
    const updatedItems = [...currentKit.items];
    
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (!item.selected) continue;
      
      setLoadingMsg(`Renderizando: ${item.name}...`);
      item.status = 'generating';
      setCurrentKit({ ...currentKit, items: [...updatedItems] });
      
      try {
        const url = await outfitService.generateItemRender(item, currentKit.originalImage, modelId);
        item.imageUrl = url;
        item.status = 'done';

        generationHistoryService.save({
          imageUrl: url,
          module: 'outfit_extractor',
          moduleLabel: `Outfit Extractor (${item.name})`,
          creditsUsed: CREDIT_COSTS.OUTFIT_PER_GARMENT,
          promptText: `Render for ${item.name}`
        }).catch(console.error);
      } catch (e: any) {
        item.status = 'error';
      }
      setCurrentKit({ ...currentKit, items: [...updatedItems] });
    }
    setStep('reviewing_renders');
  };

  const composeFinalKit = async () => {
    if (!currentKit) return;
    setStep('composing');
    setLoadingMsg('Componiendo Kit Comercial...');
    try {
      const finalUrl = await outfitService.generateFinalComposition(currentKit, modelId);
      
      generationHistoryService.save({
        imageUrl: finalUrl,
        module: 'outfit_extractor',
        moduleLabel: 'Outfit Extractor (Final Kit)',
        creditsUsed: 0,
        promptText: 'Final composition for outfit kit'
      }).catch(console.error);

      const finalizedKit = { ...currentKit, finalKitUrl: finalUrl };
      
      const itemsToSave: SavedOutfitItem[] = currentKit.items
        .filter(it => it.status === 'done' && it.imageUrl)
        .map(it => ({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          kitId: finalizedKit.id,
          name: it.name,
          category: it.category,
          description: it.description,
          visualDescription: it.visualDescription,
          imageUrl: it.imageUrl!,
          createdAt: Date.now()
        }));

      await Promise.all([
        outfitStorage.saveKit(finalizedKit),
        outfitStorage.saveItems(itemsToSave)
      ]);

      setCurrentKit(finalizedKit);
      await loadLibrary();
      setStep('final_kit');
    } catch (e: any) {
      alert("Error en composición: " + e.message);
      setStep('reviewing_renders');
    }
  };

  const downloadAll = async (kit: OutfitKit | null = currentKit) => {
    if (!kit) return;
    setIsZipping(true);
    const imagesToZip: string[] = [];
    if (kit.finalKitUrl) imagesToZip.push(kit.finalKitUrl);
    kit.items.forEach((item) => {
      if (item.imageUrl && item.selected) {
        imagesToZip.push(item.imageUrl);
      }
    });
    if (imagesToZip.length === 0) {
      setIsZipping(false);
      return;
    }
    await downloadAsZip(imagesToZip, `Outfit_Kit_LuzIA_${kit.id.slice(-4)}.zip`, 'outfit');
    setIsZipping(false);
  };

  const reset = () => { 
    setMainView('main');
    setStep('idle'); 
    setSourceImage(null); 
    setCurrentKit(null); 
    setCurrentCombo(null);
  };

  const viewFromLibrary = (kit: OutfitKit) => {
    setCurrentKit(kit);
    setStep('final_kit');
    setMainView('main');
  };

  const openLightbox = (images: string[], initialIndex: number = 0, label: string = '') => {
    setLightboxImages(images);
    setLightboxIndex(initialIndex);
    setLightboxMetadata({ label });
    setLightboxOpen(true);
  };

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
        alert(`Has alcanzado el límite para la categoría ${item.category}`);
      }
    }
  };

  const generateCombinedOutfit = async () => {
    if (creatorSelectedItems.length === 0) return;
    
    const ok = await checkAndDeduct(CREDIT_COSTS.OUTFIT_PER_GARMENT); 
    if (!ok) return;

    setStep('composing');
    setLoadingMsg('Sincronizando Capas y Luces...');
    try {
      const finalUrl = await outfitService.generateCombinationComposition(creatorSelectedItems, modelId);
      const newCombo: OutfitCombination = {
        id: `combo_${Date.now()}`,
        name: creatorName || 'Sin Nombre',
        items: creatorSelectedItems,
        finalImageUrl: finalUrl,
        createdAt: Date.now()
      };
      await outfitStorage.saveCombination(newCombo);
      setCurrentCombo(newCombo);
      await loadLibrary();
      setMainView('library');
      setLibView('combinations');
      setStep('idle');
      setCreatorSelectedItems([]);
    } catch (e: any) {
      alert("Error en generación: " + e.message);
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

  // Calcular créditos restantes para "Isolar Selección"
  const selectedItemsCount = currentKit?.items.filter(i => i.selected).length || 0;
  const renderCost = selectedItemsCount * CREDIT_COSTS.OUTFIT_PER_GARMENT;
  const creditsAfterRender = Math.max(0, credits.available - renderCost);

  // Costo para "Generar Outfit Kit" en la sección de mezclador (1 crédito fijo)
  const comboCost = CREDIT_COSTS.OUTFIT_PER_GARMENT;
  const creditsAfterCombo = Math.max(0, credits.available - comboCost);

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 animate-in fade-in">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 px-4 pt-2">
          <div className="text-center md:text-left">
            <button onClick={reset} className="group">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none hover:text-brand-600 transition-colors">Extraer <span className="text-brand-600 group-hover:text-slate-900">prendas</span></h1>
            </button>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] italic">Extractor de prendas · Render de ropa <span className="normal-case font-medium text-slate-300 text-[8px]">(Outfit Extractor)</span></p>
              <ModuleTutorial moduleId="outfitKit" steps={TUTORIAL_CONFIGS.outfitKit} />
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => { setMainView('main'); setStep('idle'); }} 
              className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${mainView === 'main' ? 'bg-brand-600 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-400'}`}
            >
              Extraer
            </button>
            <button 
              onClick={() => setMainView('library')} 
              className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${mainView === 'library' ? 'bg-brand-600 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-400'}`}
            >
              Biblioteca
            </button>
          </div>
        </header>

        {/* Estados de carga */}
        {(step === 'detecting' || step === 'generating_renders' || step === 'composing') && (
          <div className="min-h-[400px] flex flex-col items-center justify-center space-y-8 bg-slate-900 rounded-[40px] md:rounded-[64px] border-8 border-slate-800 p-10 text-center animate-in zoom-in">
            <div className="w-16 h-16 border-4 border-white/5 border-t-brand-500 rounded-full animate-spin"></div>
            <div className="space-y-2">
              <h2 className="text-white text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none">{loadingMsg}</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">SISTEMA DE PROCESAMIENTO ACTIVO</p>
            </div>
          </div>
        )}

        {mainView === 'main' && step !== 'composing' && step !== 'detecting' && step !== 'generating_renders' && (
          <>
            {step === 'idle' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 px-4 md:px-0">
                <div className="lg:col-span-5 space-y-6">
                  <section className="bg-white p-6 md:p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 text-center">
                    <div className="space-y-4 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Subir Foto Real</label>
                      <ImageSlot
                        value={sourceImage}
                        onChange={handleSourceImageChange}
                        label="Foto de referencia"
                        hint="JPG, PNG, máximo 1024px"
                        aspectRatio="portrait"
                      />
                    </div>
                    <UploadDisclaimer />
                    <ModelSelector value={modelId} onChange={setModelId} disabled={step !== 'idle'} />
                    <button onClick={startDetection} disabled={!sourceImage} className="w-full py-5 md:py-6 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50">Analizar Outfit</button>
                  </section>
                </div>
                <div className="hidden lg:col-span-7 lg:flex flex-col items-center justify-center text-center p-12 bg-slate-900 rounded-[64px] border-8 border-slate-800 shadow-2xl space-y-8">
                  <i className="fa-solid fa-shirt text-white/5 text-8xl"></i>
                  <h3 className="text-white text-2xl font-black uppercase italic tracking-tighter">Análisis de prendas</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] max-w-xs leading-relaxed">Aísla y renderiza cada prenda con fidelidad profesional.</p>
                </div>
              </div>
            )}

            {step === 'scan_overlay' && currentKit && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 animate-in fade-in px-4 md:px-0">
                <div className="lg:col-span-7 bg-slate-900 rounded-[32px] md:rounded-[56px] p-4 border-8 border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="relative aspect-[3/4] mx-auto rounded-[20px] md:rounded-[32px] overflow-hidden" ref={containerRef}>
                    <img src={currentKit.originalImage} className="w-full h-full object-cover opacity-60 grayscale transition-all duration-1000" />
                    
                    <div className="absolute inset-x-0 h-1 bg-brand-400 shadow-[0_0_15px_#FF748B] animate-scan z-30 opacity-50"></div>
                    <style>{`
                      @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
                      .animate-scan { animation: scan 3s linear infinite; }
                    `}</style>

                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                      {currentKit.items.map((item) => {
                        if (!item.selected) return null;
                        const x = `${item.coordinates.x / 10}%`;
                        const y = `${item.coordinates.y / 10}%`;
                        return (
                          <g key={`line-${item.id}`}>
                            <circle cx={x} cy={y} r="5" fill="#FF748B" className="animate-pulse shadow-lg" />
                            <line x1={x} y1={y} x2={x} y2={`${item.coordinates.y / 10 - 4}%`} stroke="#FF748B" strokeWidth="2" strokeDasharray="4" className="opacity-40" />
                          </g>
                        );
                      })}
                    </svg>

                    {currentKit.items.map((item) => (
                      <button
                        key={`label-${item.id}`}
                        onClick={() => toggleItemSelection(item.id)}
                        style={{ left: `${item.coordinates.x / 10}%`, top: `${item.coordinates.y / 10}%` }}
                        className={`absolute z-20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all -translate-x-1/2 -translate-y-8 shadow-2xl border-2 min-w-[44px] min-h-[44px] ${
                          item.selected 
                            ? 'bg-brand-600 text-white border-brand-400 scale-110' 
                            : 'bg-black/80 text-white/30 border-white/10 scale-90 opacity-60'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col space-y-6">
                  <section className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm space-y-8 flex-1">
                    <header className="border-b pb-6 text-center md:text-left">
                      <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none">Aprobar Elementos</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic leading-relaxed">
                        Solo los elementos seleccionados formarán parte del kit final.
                      </p>
                    </header>

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => quickSelect('clothing')} className="py-4 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-600 active:scale-95 transition-all">Solo Prendas</button>
                      <button onClick={() => quickSelect('clothing_footwear')} className="py-4 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-600 active:scale-95 transition-all">Prendas + Calzado</button>
                      <button onClick={() => quickSelect('all')} className="py-4 bg-brand-50 border border-brand-100 rounded-xl text-[10px] font-black uppercase text-brand-600 active:scale-95 transition-all">Todo</button>
                      <button onClick={() => quickSelect('none')} className="py-4 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black uppercase text-red-600 active:scale-95 transition-all">Ninguno</button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                      {currentKit.items.map(item => (
                        <div 
                          key={`list-${item.id}`} 
                          onClick={() => toggleItemSelection(item.id)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${item.selected ? 'border-brand-600 bg-brand-50' : 'border-slate-50 bg-slate-50 opacity-50'}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.selected ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <i className={`fa-solid ${item.category === 'footwear' ? 'fa-shoe-prints' : item.category === 'bag' ? 'fa-bag-shopping' : 'fa-shirt'}`}></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-900 uppercase truncate leading-none">{item.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">SISTEMA GHOST MANNEQUIN</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${item.selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200'}`}>
                            {item.selected && <i className="fa-solid fa-check text-[10px]"></i>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Botón de "Isolar Selección" convertido a GenerateButton */}
                    <GenerateButton
                      onClick={confirmSelectionAndRender}
                      disabled={selectedItemsCount === 0}
                      label={`Isolar Selección (${selectedItemsCount})`}
                      loadingLabel="Renderizando..."
                      imageCount={selectedItemsCount}
                      creditsAfter={creditsAfterRender}
                      className="w-full py-6 rounded-[24px] text-xs uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 disabled:opacity-30"
                    />
                  </section>
                </div>
              </div>
            )}

            {step === 'reviewing_renders' && currentKit && (
              <div className="space-y-8 animate-in fade-in px-4 md:px-0">
                <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm gap-6">
                  <div className="text-center md:text-left">
                    <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none">Renders Individuales</h3>
                    <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mt-1 italic">MÁXIMA FIDELIDAD 2K COMPLETADA</p>
                  </div>
                  <button 
                    onClick={composeFinalKit} 
                    disabled={currentKit.items.filter(i => i.selected && i.status === 'done').length === 0}
                    className="w-full md:w-auto px-10 py-5 bg-brand-600 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Componer Kit Final ({currentKit.items.filter(i => i.selected && i.status === 'done').length})
                  </button>
                </header>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {currentKit.items.filter(i => i.selected).map((item) => (
                    <div 
                      key={item.id} 
                      className={`bg-white p-4 rounded-[32px] border-4 transition-all shadow-sm space-y-4 group cursor-pointer ${item.selected ? 'border-brand-600' : 'border-transparent opacity-60'}`}
                    >
                      <div className="aspect-[3/4] bg-slate-50 rounded-[24px] overflow-hidden relative">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} className="w-full h-full object-contain hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-200">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        {item.selected && (
                          <div className="absolute top-3 right-3 w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                            <i className="fa-solid fa-check"></i>
                          </div>
                        )}
                        <div 
                          className="absolute inset-0 bg-black/40 opacity-0 md:group-hover:opacity-100 flex items-center justify-center transition-opacity" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (item.imageUrl) openLightbox([item.imageUrl], 0, item.name);
                          }}
                        >
                          <i className="fa-solid fa-expand text-white text-2xl"></i>
                        </div>
                      </div>
                      <p className="text-[10px] font-black text-slate-900 uppercase truncate text-center">{item.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'final_kit' && currentKit && (
              <div className="space-y-8 md:space-y-10 animate-in zoom-in px-4 md:px-0">
                <div className="bg-white p-8 md:p-16 rounded-[48px] border border-slate-100 shadow-2xl text-center space-y-8 md:space-y-12">
                  <header>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Kit Publicitario Consolidado</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">ACTIVOS SELECCIONADOS POR EL USUARIO</p>
                  </header>
                  
                  <div 
                    className="max-w-xl mx-auto aspect-[3/4] bg-slate-50 rounded-[40px] md:rounded-[56px] overflow-hidden shadow-2xl relative group border-8 border-white cursor-pointer" 
                    onClick={() => currentKit.finalKitUrl && openLightbox([currentKit.finalKitUrl], 0, 'Kit Final')}
                  >
                    {currentKit.finalKitUrl ? (
                      <img src={currentKit.finalKitUrl} className="w-full h-full object-contain" />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-200">
                        <i className="fa-solid fa-spinner animate-spin text-3xl mb-4 text-brand-500"></i>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <i className="fa-solid fa-expand text-white text-4xl"></i>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => downloadAll()} disabled={isZipping} className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95">
                      {isZipping ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-zipper"></i>}
                      Exportar Pack (.zip)
                    </button>
                    <button onClick={reset} className="w-full sm:w-auto px-12 py-5 bg-white border border-slate-200 text-slate-900 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95">Nueva Producción</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {mainView === 'library' && (
          <div className="space-y-8 px-4 md:px-0">
            <nav className="flex items-center gap-2 p-2 bg-slate-100 rounded-3xl w-full overflow-x-auto md:w-fit">
              {[
                { id: 'kits', label: 'Extracciones', icon: 'fa-box' },
                { id: 'items', label: 'Prendas', icon: 'fa-shirt' },
                { id: 'combinations', label: 'Outfit Sets', icon: 'fa-user-tie' },
                { id: 'creator', label: 'Crear Mix', icon: 'fa-plus' }
              ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setLibView(tab.id as LibraryView)}
                  className={`px-4 md:px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 transition-all whitespace-nowrap ${libView === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <i className={`fa-solid ${tab.icon}`}></i>
                  <span className={libView === tab.id ? '' : 'hidden md:inline'}>{tab.label}</span>
                </button>
              ))}
            </nav>

            {libView === 'kits' && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {libraryKits.map(kit => (
                  <div key={kit.id} className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-4 group">
                    <div className="aspect-[3/4] bg-slate-50 rounded-[24px] overflow-hidden relative cursor-pointer" onClick={() => viewFromLibrary(kit)}>
                      <img src={kit.finalKitUrl || ''} className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <i className="fa-solid fa-eye text-white text-2xl"></i>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-slate-900">Kit #{kit.id.slice(-4)}</p>
                      <button onClick={(e) => handleDeleteKit(kit.id, e)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                ))}
                {libraryKits.length === 0 && <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] opacity-60">No hay extracciones completas</div>}
              </div>
            )}

            {libView === 'items' && (
              <div className="space-y-10">
                {(Object.entries(categorizedItems) as [string, SavedOutfitItem[]][]).map(([cat, items]) => (
                  items.length > 0 && (
                    <section key={cat} className="space-y-4">
                      <h4 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px]"><i className="fa-solid fa-tag"></i></span>
                        {cat === 'top' ? 'Superior / Tops' : cat === 'bottom' ? 'Inferior / Bottoms' : cat === 'footwear' ? 'Calzado' : cat === 'accessory' ? 'Accesorios' : cat === 'bag' ? 'Bolsos' : 'Prendas Principales'}
                        <span className="text-slate-400 not-italic ml-2 opacity-50">({items.length} activos)</span>
                      </h4>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {items.map(item => (
                          <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm relative group">
                            <img 
                              src={item.imageUrl} 
                              className="aspect-[3/4] w-full object-contain bg-slate-50 rounded-xl cursor-pointer" 
                              onClick={() => openLightbox([item.imageUrl], 0, item.name)} 
                            />
                            <button 
                              onClick={(e) => handleDeleteItem(item.id, e)} 
                              className="absolute top-4 right-4 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            >
                              <i className="fa-solid fa-trash text-[10px]"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                ))}
                {libraryItems.length === 0 && <div className="py-20 text-center bg-slate-50 rounded-[40px] opacity-60">Tu biblioteca de prendas individuales está vacía</div>}
              </div>
            )}

            {libView === 'combinations' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {libraryCombinations.map(combo => (
                  <div key={combo.id} className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-lg space-y-6">
                    <h4 className="text-lg font-black text-slate-900 uppercase italic leading-none">{combo.name}</h4>
                    <div className="aspect-[3/4] bg-slate-50 rounded-[32px] overflow-hidden relative cursor-pointer" onClick={() => combo.finalImageUrl && openLightbox([combo.finalImageUrl], 0, combo.name)}>
                      <img src={combo.finalImageUrl || ''} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { const a = document.createElement('a'); a.href = combo.finalImageUrl!; a.download = `${combo.name}.png`; a.click(); }} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Descargar Set</button>
                      <button onClick={(e) => handleDeleteCombination(combo.id, e)} className="px-6 bg-red-50 text-red-500 rounded-2xl active:scale-95 transition-all"><i className="fa-solid fa-trash-can"></i></button>
                    </div>
                  </div>
                ))}
                {libraryCombinations.length === 0 && <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] opacity-60">Aún no has creado combinaciones personalizadas</div>}
              </div>
            )}

            {libView === 'creator' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 bg-white p-6 md:p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-10">
                  <header>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic">Mezclador de Prendas Pro</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Sincronización Inteligente de Capas</p>
                  </header>
                  
                  <div className="space-y-10">
                    {['top', 'bottom', 'footwear', 'accessory'].map(cat => (
                      <section key={cat} className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            {cat === 'top' ? 'Superior (Max 3)' : cat === 'bottom' ? 'Inferior (Max 3)' : cat === 'footwear' ? 'Calzado (1)' : 'Accesorios (Max 6)'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{categorizedItems[cat]?.length || 0} disponibles</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                          {categorizedItems[cat]?.map(item => {
                            const isSelected = creatorSelectedItems.some(i => i.id === item.id);
                            return (
                              <div 
                                key={item.id} 
                                onClick={() => toggleCreatorItem(item)}
                                className={`flex-none w-24 aspect-[3/4] border-4 rounded-2xl overflow-hidden cursor-pointer transition-all relative ${isSelected ? 'border-brand-600 scale-105 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}
                              >
                                <img src={item.imageUrl} className="w-full h-full object-contain bg-slate-50" />
                                {isSelected && <div className="absolute inset-0 bg-brand-600/20 flex items-center justify-center"><i className="fa-solid fa-check text-white text-xl"></i></div>}
                              </div>
                            );
                          })}
                          {(!categorizedItems[cat] || categorizedItems[cat].length === 0) && <div className="h-24 flex items-center text-slate-300 text-[10px] font-black uppercase px-6 bg-slate-50 rounded-2xl border-2 border-dashed">No hay prendas en esta categoría</div>}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-6 sticky top-24">
                  <section className="bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white space-y-6 border-8 border-slate-800">
                    <h4 className="text-xl font-black uppercase italic tracking-tighter">Tu Nuevo Set</h4>
                    
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Nombre del Conjunto</label>
                      <input 
                        type="text" 
                        value={creatorName}
                        onChange={e => setCreatorName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold focus:border-brand-500 outline-none transition-all"
                        placeholder="Ej: Outfit Casual Verano"
                      />
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 italic">Prendas Seleccionadas ({creatorSelectedItems.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {creatorSelectedItems.map(item => (
                          <div key={item.id} className="px-4 py-2 bg-white/10 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                            {item.name}
                            <button onClick={() => toggleCreatorItem(item)} className="ml-1 text-white/30 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Costo de Mezcla</span>
                        <span className="text-brand-400 font-black text-lg uppercase italic leading-none">1 Crédito</span>
                      </div>
                      <GenerateButton
                        onClick={generateCombinedOutfit}
                        disabled={creatorSelectedItems.length === 0}
                        label="Generar Outfit Kit"
                        loadingLabel="Generando..."
                        imageCount={1}
                        creditsAfter={creditsAfterCombo}
                        className="w-full py-6 rounded-[24px] text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIGHTBOX UNIVERSAL */}
        {lightboxOpen && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onDownload={(url, idx) => {
              const link = document.createElement('a');
              link.href = url;
              link.download = `luzia_asset_${idx + 1}.png`;
              link.click();
            }}
            metadata={lightboxMetadata}
          />
        )}

        {/* FLOATING ACTION BAR (aparece en final_kit al hacer scroll) */}
        {step === 'final_kit' && currentKit && fabVisible && (
          <FloatingActionBar
            isVisible={true}
            primaryAction={{
              label: 'Descargar ZIP',
              icon: <i className="fa-solid fa-file-zipper text-sm"></i>,
              onClick: () => downloadAll(),
              loading: isZipping,
            }}
            onClearSelection={reset}
            selectedCount={0}
          />
        )}
      </div>
    </>
  );
};

export default OutfitExtractorModule;