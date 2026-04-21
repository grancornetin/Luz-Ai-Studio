// modules/outfitExtractor/OutfitExtractorModule.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../../services/creditConfig';
import { generationHistoryService } from '../../services/generationHistoryService';
import { outfitService } from './outfitService';
import { outfitStorage } from './outfitStorage';e
import { OutfitKit, OutfitItem, SavedOutfitItem, OutfitCombination } from './types';
import JSZip from 'jszip';

type Step = 'idle' | 'detecting' | 'scan_overlay' | 'generating_renders' | 'reviewing_renders' | 'composing' | 'final_kit' | 'library';
type LibraryView = 'kits' | 'items' | 'combinations' | 'creator';

const OutfitExtractorModule: React.FC = () => {
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
  const [selectedZoom, setSelectedZoom] = useState<string | null>(null);
  const [creatorSelectedItems, setCreatorSelectedItems] = useState<SavedOutfitItem[]>([]);
  const [creatorName, setCreatorName] = useState('Nuevo Outfit Set');

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const { readAndCompressFile } = await import('../../utils/imageUtils');
      const compressed = await readAndCompressFile(e.target.files[0]);
      setSourceImage(compressed);
    }
  };

  const startDetection = async () => {
    if (!sourceImage) return;
    setStep('detecting');
    setLoadingMsg('Iniciando Escaneo Biométrico...');
    try {
      const result = await outfitService.extractOutfitKit(sourceImage);
      setCurrentKit(result);
      setStep('scan_overlay');
    } catch (e: any) {
      alert("Error en el escaneo: " + e.message);
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
        const url = await outfitService.generateItemRender(item, currentKit.originalImage);
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
      const finalUrl = await outfitService.generateFinalComposition(currentKit);
      
      generationHistoryService.save({
        imageUrl: finalUrl,
        module: 'outfit_extractor',
        moduleLabel: 'Outfit Extractor (Final Kit)',
        creditsUsed: 0,
        promptText: 'Final composition for outfit kit'
      }).catch(console.error);

      const finalizedKit = { ...currentKit, finalKitUrl: finalUrl };
      
      // Guardar prendas individuales en la biblioteca
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
    const zip = new JSZip();
    if (kit.finalKitUrl) zip.file('KIT_COMPLETO_LUZIA.png', kit.finalKitUrl.split(',')[1], { base64: true });
    kit.items.forEach((item, idx) => {
      if (item.imageUrl && item.selected) {
        zip.file(`ACTIVO_${idx + 1}_${item.name.replace(/\s+/g, '_')}.png`, item.imageUrl.split(',')[1], { base64: true });
      }
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Outfit_Kit_LuzIA_${kit.id.slice(-4)}.zip`; a.click();
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

  // --- Creator Logic ---
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
      const finalUrl = await outfitService.generateCombinationComposition(creatorSelectedItems);
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

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────
  return (
    <>
    <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 animate-in fade-in">
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 px-4 pt-2">
        <div className="text-center md:text-left">
          <button onClick={reset} className="group">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none hover:text-brand-600 transition-colors">Outfit <span className="text-brand-600 group-hover:text-slate-900">Extractor</span></h1>
          </button>
          <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
            <p className="text-slate-400 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.3em] italic">PRODUCCIÓN GHOST MANNEQUIN 3D</p>
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
            <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.5em] animate-pulse">SISTEMA DE PROCESAMIENTO ACTIVO</p>
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
                    <label className="aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50/50 transition-all text-slate-300 relative overflow-hidden group">
                      {sourceImage ? (
                        <img src={sourceImage} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center">
                          <i className="fa-solid fa-cloud-arrow-up text-4xl mb-4 text-brand-300"></i>
                          <span className="text-[10px] font-black uppercase text-slate-400">Seleccionar Imagen</span>
                        </div>
                      )}
                      <input type="file" hidden onChange={handleFileUpload} />
                    </label>
                  </div>
                  <button onClick={startDetection} disabled={!sourceImage} className="w-full py-5 md:py-6 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50">Analizar Outfit</button>
                </section>
              </div>
              <div className="hidden lg:col-span-7 lg:flex flex-col items-center justify-center text-center p-12 bg-slate-900 rounded-[64px] border-8 border-slate-800 shadow-2xl space-y-8">
                <i className="fa-solid fa-shirt text-white/5 text-8xl"></i>
                <h3 className="text-white text-2xl font-black uppercase italic tracking-tighter">Motor Vertex AI</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] max-w-xs leading-relaxed">Aísla productos con fidelidad 2K usando referencias visuales.</p>
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
                      className={`absolute z-20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all -translate-x-1/2 -translate-y-8 shadow-2xl border-2 ${
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
                    <button onClick={() => quickSelect('clothing')} className="py-4 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-600 active:scale-95 transition-all">Solo Prendas</button>
                    <button onClick={() => quickSelect('clothing_footwear')} className="py-4 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-600 active:scale-95 transition-all">Prendas + Calzado</button>
                    <button onClick={() => quickSelect('all')} className="py-4 bg-brand-50 border border-brand-100 rounded-xl text-[9px] font-black uppercase text-brand-600 active:scale-95 transition-all">Todo</button>
                    <button onClick={() => quickSelect('none')} className="py-4 bg-red-50 border border-red-100 rounded-xl text-[9px] font-black uppercase text-red-600 active:scale-95 transition-all">Ninguno</button>
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
                          <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">SISTEMA GHOST MANNEQUIN</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${item.selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200'}`}>
                          {item.selected && <i className="fa-solid fa-check text-[10px]"></i>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={confirmSelectionAndRender} 
                    disabled={currentKit.items.filter(i => i.selected).length === 0}
                    className="w-full py-6 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-30"
                  >
                    Isolar Selección ({currentKit.items.filter(i => i.selected).length})
                  </button>
                </section>
              </div>
            </div>
          )}

          {step === 'reviewing_renders' && currentKit && (
            <div className="space-y-8 animate-in fade-in px-4 md:px-0">
              <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm gap-6">
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none">Renders Individuales</h3>
                  <p className="text-[9px] font-black text-accent-500 uppercase tracking-widest mt-1 italic">MÁXIMA FIDELIDAD 2K COMPLETADA</p>
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
                    onClick={() => toggleItemSelection(item.id)}
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
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" onClick={(e) => { e.stopPropagation(); item.imageUrl && setSelectedZoom(item.imageUrl); }}>
                        <i className="fa-solid fa-expand text-white text-2xl"></i>
                      </div>
                    </div>
                    <p className="text-[9px] font-black text-slate-900 uppercase truncate text-center">{item.name}</p>
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
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">ACTIVOS SELECCIONADOS POR EL USUARIO</p>
                </header>
                
                <div className="max-w-xl mx-auto aspect-[3/4] bg-slate-50 rounded-[40px] md:rounded-[56px] overflow-hidden shadow-2xl relative group border-8 border-white cursor-pointer" onClick={() => currentKit.finalKitUrl && setSelectedZoom(currentKit.finalKitUrl)}>
                  {currentKit.finalKitUrl ? (
                    <img src={currentKit.finalKitUrl} className="w-full h-full object-contain" />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-200">
                      <i className="fa-solid fa-spinner animate-spin text-3xl mb-4 text-brand-500"></i>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><i className="fa-solid fa-expand text-white text-4xl"></i></div>
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
                          <img src={item.imageUrl} className="aspect-[3/4] w-full object-contain bg-slate-50 rounded-xl cursor-pointer" onClick={() => setSelectedZoom(item.imageUrl)} />
                          <button onClick={(e) => handleDeleteItem(item.id, e)} className="absolute top-4 right-4 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-trash text-[10px]"></i></button>
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
                  <div className="aspect-[3/4] bg-slate-50 rounded-[32px] overflow-hidden relative cursor-pointer" onClick={() => setSelectedZoom(combo.finalImageUrl || null)}>
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
                        <span className="text-[9px] font-bold text-slate-400">{categorizedItems[cat]?.length || 0} disponibles</span>
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
                        {(!categorizedItems[cat] || categorizedItems[cat].length === 0) && <div className="h-24 flex items-center text-slate-300 text-[8px] font-black uppercase px-6 bg-slate-50 rounded-2xl border-2 border-dashed">No hay prendas en esta categoría</div>}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6 sticky top-24">
                <section className="bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white space-y-6 border-8 border-slate-800">
                  <h4 className="text-xl font-black uppercase italic tracking-tighter">Tu Nuevo Set</h4>
                  
                  <div className="space-y-4">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Nombre del Conjunto</label>
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
                        <div key={item.id} className="px-4 py-2 bg-white/10 rounded-full flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
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
                    <button 
                      onClick={generateCombinedOutfit}
                      disabled={creatorSelectedItems.length === 0}
                      className="w-full py-6 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                    >
                      Generar Outfit Kit
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedZoom && (
        <div className="fixed inset-0 z-[10000] bg-black/98 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-10 animate-in fade-in" onClick={() => setSelectedZoom(null)}>
          <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedZoom(null)} className="absolute top-0 right-0 w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-transform"><i className="fa-solid fa-xmark text-xl"></i></button>
            <div className="bg-white/5 p-2 rounded-[32px] md:rounded-[48px] border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center">
              <img src={selectedZoom} className="max-w-full max-h-[85vh] object-contain rounded-[24px] md:rounded-[40px]" />
            </div>
            <button onClick={() => { const a = document.createElement('a'); a.href = selectedZoom; a.download = 'LUZIA_ASSET_PRO.png'; a.click(); }} className="px-10 py-5 bg-white text-slate-900 rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Descargar Activo</button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default OutfitExtractorModule;