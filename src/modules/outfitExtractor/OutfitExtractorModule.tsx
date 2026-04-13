import React, { useState, useRef, useEffect } from 'react';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../../services/creditConfig';
import { generationHistoryService } from '../../services/generationHistoryService';
import { outfitService } from './outfitService';
import { outfitStorage } from './outfitStorage';
import { OutfitKit, OutfitItem } from './types';
import JSZip from 'jszip';

type Step = 'idle' | 'detecting' | 'scan_overlay' | 'generating_renders' | 'reviewing_renders' | 'composing' | 'final_kit' | 'library';

const OutfitExtractorModule: React.FC = () => {
  const [step, setStep] = useState<Step>('idle');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [currentKit, setCurrentKit] = useState<OutfitKit | null>(null);
  const [libraryKits, setLibraryKits] = useState<OutfitKit[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  const [selectedZoom, setSelectedZoom] = useState<string | null>(null);
  // Tutorial: usa ModuleTutorial
  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    const kits = await outfitStorage.listKits();
    setLibraryKits(kits);
  };

  const handleDeleteKit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar este kit permanentemente?")) {
      await outfitStorage.deleteKit(id);
      await loadLibrary();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => { setSourceImage(reader.result as string); };
      reader.readAsDataURL(e.target.files[0]);
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

        // Guardar en historial (background)
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
      
      // Guardar en historial (background)
      generationHistoryService.save({
        imageUrl: finalUrl,
        module: 'outfit_extractor',
        moduleLabel: 'Outfit Extractor (Final Kit)',
        creditsUsed: 0,
        promptText: 'Final composition for outfit kit'
      }).catch(console.error);

      const finalizedKit = { ...currentKit, finalKitUrl: finalUrl };
      await outfitStorage.saveKit(finalizedKit);
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

  const reset = () => { setStep('idle'); setSourceImage(null); setCurrentKit(null); };

  const viewFromLibrary = (kit: OutfitKit) => {
    setCurrentKit(kit);
    setStep('final_kit');
  };

  return (
    <>
    <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 animate-in fade-in">
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 px-4 pt-2">
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Outfit <span className="text-brand-600">Extractor</span></h1>
          <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
            <p className="text-slate-400 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.3em] italic">PRODUCCIÓN GHOST MANNEQUIN 3D</p>
            <ModuleTutorial moduleId="outfitKit" steps={TUTORIAL_CONFIGS.outfitKit} />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {step !== 'idle' && (
            <button onClick={reset} className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 shadow-sm transition-all active:scale-95">Nueva Extracción</button>
          )}
          <button onClick={() => setStep('library')} className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${step === 'library' ? 'bg-brand-600 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-400'}`}>
            Biblioteca ({libraryKits.length})
          </button>
        </div>
      </header>

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
              <button 
                onClick={startDetection} 
                disabled={!sourceImage} 
                className="w-full py-5 md:py-6 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50"
              >
                Analizar Outfit
              </button>
            </section>
          </div>
          <div className="hidden lg:col-span-7 lg:flex flex-col items-center justify-center text-center p-12 bg-slate-900 rounded-[64px] border-8 border-slate-800 shadow-2xl space-y-8">
            <i className="fa-solid fa-shirt text-white/5 text-8xl"></i>
            <h3 className="text-white text-2xl font-black uppercase italic tracking-tighter">Motor Gemini 3 Pro</h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] max-w-xs leading-relaxed">Aísla productos con fidelidad 2K. Ideal para catálogos digitales de alta gama.</p>
          </div>
        </div>
      )}

      {(step === 'detecting' || step === 'generating_renders' || step === 'composing') && (
        <div className="min-h-[400px] flex flex-col items-center justify-center space-y-8 bg-slate-900 rounded-[40px] md:rounded-[64px] border-8 border-slate-800 p-10 text-center animate-in zoom-in">
           <div className="w-16 h-16 border-4 border-white/5 border-t-brand-500 rounded-full animate-spin"></div>
           <div className="space-y-2">
             <h2 className="text-white text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none">{loadingMsg}</h2>
             <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.5em] animate-pulse">SISTEMA DE PROCESAMIENTO ACTIVO</p>
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
              <button onClick={composeFinalKit} className="w-full md:w-auto px-10 py-5 bg-brand-600 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-brand-700 transition-all active:scale-95">Componer Kit Final</button>
           </header>
           
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {currentKit.items.filter(i => i.selected).map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-4 group">
                   <div className="aspect-[3/4] bg-slate-50 rounded-[24px] overflow-hidden relative cursor-pointer" onClick={() => item.imageUrl && setSelectedZoom(item.imageUrl)}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} className="w-full h-full object-contain hover:scale-110 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-200">
                          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><i className="fa-solid fa-expand text-white text-2xl"></i></div>
                   </div>
                   <p className="text-[9px] font-black text-slate-400 uppercase truncate text-center">{item.name}</p>
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

      {step === 'library' && (
        <div className="space-y-10 animate-in fade-in px-4 md:px-0">
          <header className="flex items-center justify-between border-b pb-6">
            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Biblioteca de Renders</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Almacenamiento Circular (Máx 10)</p>
          </header>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {libraryKits.map((kit) => (
              <div key={kit.id} className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-4 group">
                <div className="aspect-[3/4] bg-slate-50 rounded-[24px] overflow-hidden relative cursor-pointer" onClick={() => viewFromLibrary(kit)}>
                  {kit.finalKitUrl ? (
                    <img src={kit.finalKitUrl} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-200">
                      <i className="fa-solid fa-image text-3xl"></i>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <i className="fa-solid fa-eye text-white text-2xl"></i>
                  </div>
                </div>
                <div className="flex items-center justify-between px-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-slate-900 uppercase truncate">Kit #{kit.id.slice(-4)}</p>
                    <p className="text-[7px] text-slate-400 font-bold uppercase">{new Date(kit.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); downloadAll(kit); }} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-brand-600 hover:text-white transition-all">
                      <i className="fa-solid fa-download text-[10px]"></i>
                    </button>
                    <button onClick={(e) => handleDeleteKit(kit.id, e)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all">
                      <i className="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {libraryKits.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                <i className="fa-solid fa-folder-open text-5xl text-slate-200 mb-4"></i>
                <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No hay kits guardados</p>
              </div>
            )}
          </div>
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