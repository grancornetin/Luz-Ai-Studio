
import React, { useState } from 'react';
import { OutfitKit, OutfitItem } from '../modules/outfitExtractor/types';
import { outfitService } from '../modules/outfitExtractor/outfitService';
import JSZip from 'jszip';
import { readAndCompressFile } from '../utils/imageUtils';

type ExtractorStep = 'idle' | 'extracting_items' | 'selection_checkpoint' | 'composing_final' | 'completed';

const OutfitExtractor: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [step, setStep] = useState<ExtractorStep>('idle');
  const [status, setStatus] = useState('');
  const [currentKit, setCurrentKit] = useState<OutfitKit | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const compressed = await readAndCompressFile(e.target.files[0]);
      setSourceImage(compressed);
    }
  };

  const startExtraction = async () => {
    if (!sourceImage) return;

    setStep('extracting_items');
    setStatus('Analizando composición del outfit...');
    setCurrentKit(null);
    setSelectedItemIds(new Set());

    try {
      // 1. Extraer ítems detectados vía IA
      const kit = await outfitService.analyzeOutfit(sourceImage);
      setCurrentKit(kit);

      // 2. Generación secuencial con DELAY de seguridad para cuota
      setStatus(`Generando renders aislados (0/${kit.items.length})...`);
      const updatedItems = [...kit.items];
      
      for (let i = 0; i < updatedItems.length; i++) {
        // Pausa preventiva para no saturar 429 Resource Exhausted
        if (i > 0) await new Promise(r => setTimeout(r, 1500));
        
        setStatus(`Renderizando: ${updatedItems[i].name} (${i + 1}/${updatedItems.length})...`);
        try {
          // Fixed: generateItemRender call uses originalImage
          const img = await outfitService.generateItemRender(updatedItems[i], sourceImage);
          updatedItems[i].imageUrl = img;
          setCurrentKit({ ...kit, items: [...updatedItems] });
          // Autoselección inicial
          setSelectedItemIds(prev => new Set(prev).add(updatedItems[i].id));
        } catch (err: any) {
          console.error(`Error generating item ${updatedItems[i].name}`, err);
        }
      }

      setStep('selection_checkpoint');
      setStatus('Checkpoint: Selecciona los elementos para el Kit Final');
    } catch (e: any) {
      alert("Error en la extracción: " + e.message);
      setStep('idle');
    }
  };

  const generateFinalKit = async () => {
    if (!currentKit || selectedItemIds.size === 0) {
      alert("Debes seleccionar al menos un elemento.");
      return;
    }

    setStep('composing_final');
    setStatus('Componiendo Kit Publicitario con elementos seleccionados...');

    try {
      // Fixed: Passing filtered items kit
      const filteredItems = currentKit.items.filter(item => selectedItemIds.has(item.id));
      const filteredKit = { ...currentKit, items: filteredItems };

      const finalUrl = await outfitService.generateFinalComposition(filteredKit);
      setCurrentKit({ ...currentKit, finalKitUrl: finalUrl });
      setStep('completed');
      setStatus('Kit Publicitario finalizado.');
    } catch (e: any) {
      alert("Error en la composición final: " + e.message);
      setStep('selection_checkpoint');
    }
  };

  const toggleItemSelection = (id: string) => {
    if (step !== 'selection_checkpoint') return;
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadIndividual = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `Item_${name.replace(/\s+/g, '_')}_LuzIA.png`;
    link.click();
  };

  const downloadAllZip = async () => {
    if (!currentKit) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      if (currentKit.finalKitUrl) {
        zip.file("00_OUTFIT_KIT_COMPLETO.png", currentKit.finalKitUrl.split(',')[1], { base64: true });
      }
      currentKit.items.forEach((item, i) => {
        if (item.imageUrl && selectedItemIds.has(item.id)) {
          zip.file(`0${i + 1}_${item.name.replace(/\s+/g, '_')}.png`, item.imageUrl.split(',')[1], { base64: true });
        }
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Outfit_Kit_LuzIA_${Date.now()}.zip`;
      link.click();
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Outfit <span className="text-indigo-600">Extractor</span></h1>
          <p className="text-slate-500 font-medium italic mt-1 text-sm">Escaneo de prendas y generación de kits comerciales.</p>
        </div>
        {(step === 'completed' || step === 'selection_checkpoint') && (
          <button onClick={() => { setSourceImage(null); setCurrentKit(null); setStep('idle'); }} className="px-6 py-3 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:text-slate-600 transition-colors">Nueva Extracción</button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={`lg:col-span-4 space-y-6 ${step.startsWith('extracting') || step === 'composing_final' ? 'opacity-40 pointer-events-none' : ''}`}>
          <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 sticky top-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Imagen de Referencia</label>
              <label className={`aspect-square rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all ${sourceImage ? 'border-indigo-500 border-solid' : 'border-slate-100 hover:bg-indigo-50'}`}>
                {sourceImage ? (
                  <img src={sourceImage} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-8">
                    <i className="fa-solid fa-shirt text-slate-200 text-5xl mb-4"></i>
                    <p className="text-[10px] font-black uppercase text-slate-400">Sube una referencia de moda</p>
                  </div>
                )}
                {step === 'idle' && <input type="file" hidden onChange={handleFileUpload} />}
              </label>
            </div>

            {step === 'selection_checkpoint' && (
              <div className="p-6 bg-amber-50 rounded-[32px] border border-amber-100 space-y-4 animate-in slide-in-from-top-4">
                <h3 className="text-[10px] font-black uppercase text-amber-700 tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-clipboard-check"></i> Checkpoint de Selección
                </h3>
                <p className="text-[11px] text-amber-900 font-bold leading-relaxed">
                  Haz clic en las prendas que deseas incluir en el kit final. {selectedItemIds.size} seleccionadas.
                </p>
                <button 
                  onClick={generateFinalKit}
                  disabled={selectedItemIds.size === 0}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all"
                >
                  Generar Kit Final ({selectedItemIds.size})
                </button>
              </div>
            )}

            {step === 'idle' && (
              <button onClick={startExtraction} disabled={!sourceImage} className="w-full py-5 bg-indigo-600 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
                Iniciar Extracción
              </button>
            )}

            {step === 'completed' && (
              <button onClick={downloadAllZip} disabled={isZipping} className="w-full py-5 bg-emerald-600 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3">
                {isZipping ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-zipper"></i>} EXPORTAR ZIP COMPLETO
              </button>
            )}
          </section>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-slate-900 rounded-[40px] md:rounded-[64px] p-6 md:p-12 min-h-[400px] md:min-h-[750px] flex flex-col shadow-2xl relative overflow-hidden border-4 md:border-8 border-slate-800">
            {step === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white/5 rounded-full flex items-center justify-center text-white/10 text-4xl md:text-6xl border border-white/10">
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase italic tracking-tighter">Fashion Asset Studio</h2>
                <p className="text-slate-500 max-w-xs mx-auto text-xs md:text-sm italic font-medium">Extrae y compone outfits como activos publicitarios independientes.</p>
              </div>
            )}

            {(step.startsWith('extracting') || step === 'composing_final') && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-indigo-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">{status}</p>
              </div>
            )}

            {(step === 'selection_checkpoint' || step === 'completed') && currentKit && (
              <div className="space-y-8 md:space-y-10 animate-in fade-in duration-1000">
                {step === 'completed' && currentKit.finalKitUrl && (
                  <div className="aspect-[3/4] max-h-[500px] md:max-h-[600px] rounded-[32px] md:rounded-[48px] overflow-hidden bg-white relative shadow-2xl border-2 md:border-4 border-emerald-500/20">
                    <img src={currentKit.finalKitUrl} className="w-full h-full object-contain cursor-zoom-in" onClick={() => setSelectedImage(currentKit.finalKitUrl!)} />
                    <button onClick={() => downloadIndividual(currentKit.finalKitUrl!, "KIT_COMPLETO")} className="absolute bottom-4 right-4 md:bottom-8 md:right-8 w-10 h-10 md:w-14 md:h-14 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"><i className="fa-solid fa-download"></i></button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
                  {currentKit.items.map((item) => {
                    const isSelected = selectedItemIds.has(item.id);
                    return (
                      <div key={item.id} onClick={() => toggleItemSelection(item.id)} className={`aspect-square rounded-[24px] md:rounded-[32px] overflow-hidden bg-white relative shadow-xl transition-all border-2 md:border-4 cursor-pointer group ${isSelected ? 'border-indigo-500 scale-[0.98]' : 'border-transparent'}`}>
                        {item.imageUrl ? (
                          <>
                            <img src={item.imageUrl} className="w-full h-full object-contain" />
                            {isSelected && <div className="absolute top-2 right-2 md:top-4 md:right-4 w-6 h-6 md:w-8 md:h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg"><i className="fa-solid fa-check text-[10px] md:text-xs"></i></div>}
                            <div className="absolute bottom-0 inset-x-0 p-3 md:p-4 bg-gradient-to-t from-black/60 to-transparent">
                              <p className="text-white text-[6px] md:text-[7px] font-black uppercase tracking-widest truncate">{item.name}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); downloadIndividual(item.imageUrl!, item.name); }} className="absolute top-2 left-2 md:top-4 md:left-4 w-6 h-6 md:w-8 md:h-8 bg-white/20 backdrop-blur-md text-white rounded-lg flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 hover:bg-white hover:text-slate-900 transition-all"><i className="fa-solid fa-download text-[8px] md:text-[10px]"></i></button>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-100/10"><i className="fa-solid fa-spinner animate-spin mb-2"></i><span className="text-[6px] font-black uppercase tracking-widest">Render...</span></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedImage && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 md:p-6 animate-in fade-in" onClick={() => setSelectedImage(null)}>
           <button className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center md:hidden">
             <i className="fa-solid fa-xmark"></i>
           </button>
           <img src={selectedImage} className="max-w-full max-h-full object-contain rounded-[24px] md:rounded-[40px] shadow-2xl animate-in zoom-in" />
        </div>
      )}
    </div>
  );
};

export default OutfitExtractor;
