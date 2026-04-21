import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { avatarService } from '../services/avatarService';
import { generationHistoryService } from '../services/generationHistoryService';
import { AvatarProfile } from '../types';
import JSZip from 'jszip';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../services/creditConfig';
import { readAndCompressFile } from '../utils/imageUtils';

interface CloningModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

type WorkflowStep = 
  | 'idle' 
  | 'analyzing' 
  | 'generating_bodymaster' 
  | 'validating_bodymaster' 
  | 'generating_technical_set' 
  | 'validating_facemaster' 
  | 'completed';

const CloningModule: React.FC<CloningModuleProps> = ({ onSave }) => {
  const [name, setName] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [step, setStep] = useState<WorkflowStep>('idle');
  const [status, setStatus] = useState('');
  const [isRegeneratingFace, setIsRegeneratingFace] = useState(false);
  
  const [previews, setPreviews] = useState<string[]>([]); // Consolidated generated images
  const [identityData, setIdentityData] = useState<any>(null);
  const [isZipping, setIsZipping] = useState(false);

  const [zoomedImageIndex, setZoomedImageIndex] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      newFiles.forEach(async (file) => {
        const compressed = await readAndCompressFile(file);
        setFiles(prev => [...prev, compressed].slice(0, 3));
      });
    }
  };

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  const startCloning = async () => {
    if (!name || files.length === 0) return alert("Nombre y fotos de referencia requeridos.");
    const ok = await checkAndDeduct(CREDIT_COSTS.CREATE_MODEL_CLONE);
    if (!ok) return;
    setStep('analyzing');
    setStatus('Analizando biometría y género...');
    setPreviews([]); // Clear previous previews
    try {
      const ext = await geminiService.extractAvatarProfile(files);
      setIdentityData(ext);
      
      setStep('generating_bodymaster');
      setStatus('Sintetizando BODYMASTER (Pies a Cabeza)...');
      const master = await avatarService.generateBodyMaster(
        ext.identity_prompt, ext.negative_prompt, files, ext.metadata.gender
      );
      setPreviews([master]);

      // Guardar en historial (background)
      generationHistoryService.save({
        imageUrl: master,
        module: 'model_dna',
        moduleLabel: 'Model DNA (BodyMaster)',
        creditsUsed: CREDIT_COSTS.CREATE_MODEL_CLONE,
        promptText: ext.identity_prompt
      }).catch(console.error);

      setStep('validating_bodymaster');
    } catch (e: any) {
      alert("Error: " + e.message);
      setStep('idle');
    }
  };

  const approveBodyMaster = async () => {
    if (previews.length === 0) return;
    setStep('generating_technical_set');
    setStatus('Generando vistas 360° y FACEMASTER...');
    try {
      const bodyMaster = previews[0];
      const views = await avatarService.generateTechnicalViews(bodyMaster, identityData.metadata.gender);
      const face = await avatarService.generateFaceMaster(bodyMaster);
      
      setPreviews([bodyMaster, views.rear, views.side, face]);

      // Guardar vistas técnicas en historial
      [views.rear, views.side, face].forEach((img, idx) => {
        const labels = ['Rear View', 'Side Profile', 'FaceMaster'];
        generationHistoryService.save({
          imageUrl: img,
          module: 'model_dna',
          moduleLabel: `Model DNA (${labels[idx]})`,
          creditsUsed: 0,
          promptText: `Vista técnica ${labels[idx]} para ${name}`
        }).catch(console.error);
      });

      setStep('validating_facemaster');
    } catch (e: any) {
      alert("Error en vistas técnicas: " + e.message);
      setStep('validating_bodymaster');
    }
  };

  const handleRegenerateFaceMaster = async () => {
    if (previews.length === 0) return;
    setIsRegeneratingFace(true);
    setStatus('Refinando FACEMASTER (Prioridad Fidelidad)...');
    try {
      const bodyMaster = previews[0];
      const face = await avatarService.generateFaceMaster(bodyMaster);
      setPreviews(prev => [prev[0], prev[1], prev[2], face]);
    } catch (e: any) {
      alert("Error regenerando rostro: " + e.message);
    } finally {
      setIsRegeneratingFace(false);
    }
  };

  const finalizeAndSave = () => {
    if (previews.length < 4) return;
    
    const newAvatar: AvatarProfile = {
      id: Date.now().toString(),
      name,
      type: 'reference',
      identityPrompt: identityData.identity_prompt,
      physicalDescription: identityData.physical_description,
      negativePrompt: identityData.negative_prompt,
      baseImages: previews, // All 4 generated images
      metadata: identityData.metadata,
      createdAt: Date.now()
    };
    onSave(newAvatar);
    setStep('completed');
  };

  const downloadFullSetZip = async () => {
    if (previews.length < 4) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      zip.file(`P1_BODYMASTER_${name}.png`, previews[0].split(',')[1], { base64: true });
      zip.file(`P2_REAR_${name}.png`, previews[1].split(',')[1], { base64: true });
      zip.file(`P3_SIDE_${name}.png`, previews[2].split(',')[1], { base64: true });
      zip.file(`P4_FACEMASTER_${name}.png`, previews[3].split(',')[1], { base64: true });
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Avatar_DNA_Set_${name}.zip`;
      link.click();
    } finally {
      setIsZipping(false);
    }
  };

  const reset = () => {
    setName('');
    setFiles([]);
    setStep('idle');
    setPreviews([]);
    setIdentityData(null);
    setZoomedImageIndex(null);
  };

  const openZoomModal = (index: number) => {
    setZoomedImageIndex(index);
  };

  const closeZoomModal = () => {
    setZoomedImageIndex(null);
  };

  const navigateZoom = (direction: 'prev' | 'next') => {
    if (zoomedImageIndex === null) return;
    let newIndex = zoomedImageIndex;
    if (direction === 'prev') {
      newIndex = (zoomedImageIndex - 1 + previews.length) % previews.length;
    } else {
      newIndex = (zoomedImageIndex + 1) % previews.length;
    }
    setZoomedImageIndex(newIndex);
  };

  return (
    <>
    <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar de Control */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
            <header className="border-b pb-4">
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Clonación DNA</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Industrial 1:1 Fidelity</p>
                <ModuleTutorial moduleId="modelDnaPhotos" steps={TUTORIAL_CONFIGS.modelDnaPhotos} compact />
              </div>
            </header>

            <div className="space-y-4">
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Nombre del Digital Twin" 
                disabled={step !== 'idle'}
                autoComplete="off"
                autoCapitalize="words"
                className="w-full px-6 py-4 rounded-2xl border bg-slate-50 font-bold text-slate-800 outline-none focus:bg-white transition-all text-base md:text-sm disabled:opacity-50" 
              />
              
              <div className="grid grid-cols-3 gap-3">
                {files.map((f, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                    <img src={f} className="w-full h-full object-cover" />
                  </div>
                ))}
                {files.length < 3 && step === 'idle' && (
                  <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                    <i className="fa-solid fa-camera text-slate-300"></i>
                    <input type="file" hidden multiple onChange={handleFileChange} />
                  </label>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                <i className="fa-solid fa-scale-balanced mr-1"></i>
                Descargo de Responsabilidad: Al subir imágenes, garantizas poseer los derechos legales. El usuario es responsable único del uso comercial y legal del contenido clonado generado por IA.
              </p>
            </div>

            {step === 'idle' && (
              <button onClick={startCloning} className="w-full py-5 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-brand-700 active:scale-95 transition-all">
                Sintetizar BODYMASTER
              </button>
            )}

            {(step === 'analyzing' || step === 'generating_bodymaster' || step === 'generating_technical_set' || isRegeneratingFace) && (
              <div className="p-6 bg-brand-900 rounded-[32px] text-white flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">{status}</p>
              </div>
            )}

            {step === 'completed' && (
              <div className="space-y-4">
                <div className="p-6 bg-accent-50 rounded-[32px] border border-accent-100 text-center">
                   <i className="fa-solid fa-circle-check text-accent-500 text-2xl mb-2"></i>
                   <p className="text-[10px] font-black text-accent-600 uppercase">Avatar Guardado en Biblioteca</p>
                </div>
                <button onClick={downloadFullSetZip} disabled={isZipping} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                  {isZipping ? 'Comprimiendo...' : 'Descargar ZIP Completo'}
                </button>
                <button onClick={reset} className="w-full py-4 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600">
                  Crear Otro Avatar
                </button>
              </div>
            )}
          </section>

          {/* CHECKPOINT 1: BODYMASTER */}
          {step === 'validating_bodymaster' && previews.length > 0 && (
            <section className="bg-brand-50 p-8 rounded-[40px] border border-brand-100 shadow-sm space-y-6 animate-in slide-in-from-bottom-4">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-brand-900 uppercase italic tracking-tighter">Checkpoint: Estructura</h3>
                <div className="space-y-3">
                  <div className="flex gap-3 bg-white/50 p-4 rounded-2xl border border-white">
                    <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">1</div>
                    <p className="text-[10px] text-brand-900 font-bold">Rostro idéntico 1:1</p>
                  </div>
                  <div className="flex gap-3 bg-white/50 p-4 rounded-2xl border border-white">
                    <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">2</div>
                    <p className="text-[10px] text-brand-900 font-bold">Cuerpo completo head-to-toe</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button onClick={startCloning} className="py-4 bg-white border border-red-100 text-red-600 rounded-2xl text-[10px] font-black uppercase">Regenerar</button>
                  <button onClick={approveBodyMaster} className="py-4 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg">Continuar</button>
                </div>
              </div>
            </section>
          )}

          {/* CHECKPOINT 2: FACEMASTER & FINALIZAR */}
          {step === 'validating_facemaster' && previews.length > 3 && (
            <section className="bg-accent-50 p-8 rounded-[40px] border border-accent-100 shadow-sm space-y-6 animate-in slide-in-from-bottom-4">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-accent-900 uppercase italic tracking-tighter">Checkpoint: Fidelidad</h3>
                <p className="text-[10px] text-accent-800 font-medium italic">Inspecciona el FACEMASTER. Debe ser la base de identidad perfecta.</p>
                <div className="flex gap-3 bg-white/50 p-4 rounded-2xl border border-white">
                  <div className="w-6 h-6 rounded-full bg-accent-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">3</div>
                  <p className="text-[10px] text-accent-900 font-bold">Identidad clonada sin drift facial</p>
                </div>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <button 
                    onClick={handleRegenerateFaceMaster} 
                    disabled={isRegeneratingFace}
                    className="py-4 bg-white border border-accent-200 text-accent-600 rounded-2xl text-[10px] font-black uppercase hover:bg-accent-100 transition-all"
                  >
                    {isRegeneratingFace ? 'Sintetizando...' : 'Re-Sintetizar FACEMASTER'}
                  </button>
                  <button onClick={finalizeAndSave} className="py-4 bg-accent-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl">Finalizar y Guardar</button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* VISUALIZADOR PRINCIPAL (TARJETAS GRANDES) */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 rounded-[56px] p-8 md:p-12 min-h-[750px] flex flex-col shadow-2xl relative">
            
            {/* VISTA BODYMASTER AISLADA */}
            {step === 'validating_bodymaster' && previews.length > 0 && (
              <div className="flex-1 flex flex-col space-y-8 animate-in fade-in duration-500">
                <header className="flex justify-between items-center border-b border-white/10 pb-6">
                  <div>
                    <h3 className="text-white font-black text-2xl uppercase italic tracking-tighter">P1: BODYMASTER (Referencia Estructural)</h3>
                    <p className="text-brand-400 text-[8px] font-black uppercase tracking-widest">Plano Técnico Base 1:1</p>
                  </div>
                </header>
                <div className="flex-1 flex items-center justify-center">
                   <div className="w-full max-w-md aspect-[3/4] rounded-[48px] overflow-hidden bg-white shadow-2xl relative border-8 border-white/10 cursor-pointer" onClick={() => openZoomModal(0)}>
                      <img src={previews[0]} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-center">
                        <p className="text-white text-[10px] font-black uppercase tracking-[0.3em]">Inspección Estructural</p>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* VISTA 360° + FACEMASTER (TARJETAS GIGANTES) */}
            {(step === 'validating_facemaster' || step === 'completed') && previews.length === 4 && (
              <div className="space-y-10 animate-in fade-in duration-1000">
                <header className="flex justify-between items-center border-b border-white/10 pb-8">
                  <div>
                    <h3 className="text-white font-black text-3xl uppercase italic tracking-tighter">{name}</h3>
                    <p className="text-brand-400 text-[10px] font-black uppercase tracking-widest">Master Digital Twin Identity Set</p>
                  </div>
                  {step === 'validating_facemaster' && (
                    <button onClick={downloadFullSetZip} className="px-6 py-4 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase border border-white/10 hover:bg-white/20">
                      Pre-visualizar Set
                    </button>
                  )}
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { img: previews[0], label: 'P1: BODYMASTER', sub: 'Frontal Technical' },
                    { img: previews[1], label: 'P2: REAR VIEW', sub: '180° Back view' },
                    { img: previews[2], label: 'P3: SIDE PROFILE', sub: '90° Side view' },
                    { 
                      img: previews[3], 
                      label: 'P4: FACEMASTER', 
                      sub: 'DNA Source 1:1', 
                      highlight: step === 'validating_facemaster',
                      loading: isRegeneratingFace
                    }
                  ].map((p, i) => (
                    <div key={i} className={`group relative aspect-[3/4] rounded-[48px] overflow-hidden bg-white shadow-2xl border-4 ${p.highlight ? 'border-accent-500' : 'border-transparent'} cursor-pointer`} onClick={() => openZoomModal(i)}>
                       <img src={p.img} className={`w-full h-full object-cover transition-all duration-700 ${p.loading ? 'blur-xl opacity-50 scale-110' : ''}`} />
                       
                       {p.loading && (
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin"></div>
                         </div>
                       )}

                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={(e) => { e.stopPropagation(); const l=document.createElement('a'); l.href=p.img; l.download=`${name}_P${i+1}.png`; l.click(); }} className="w-16 h-16 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                            <i className="fa-solid fa-download text-xl"></i>
                          </button>
                       </div>

                       <div className="absolute top-6 left-6 right-6">
                          <div className="px-5 py-2 bg-black/50 backdrop-blur-xl text-white rounded-2xl border border-white/20 flex justify-between items-center shadow-2xl">
                             <div>
                                <p className="text-[9px] font-black uppercase tracking-widest">{p.label}</p>
                                <p className="text-[7px] text-white/50 font-bold uppercase tracking-widest leading-none mt-0.5">{p.sub}</p>
                             </div>
                             {p.highlight && <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse shadow-[0_0_10px_#E4F1AC]"></span>}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>

                <footer className="p-8 bg-white/5 rounded-[40px] border border-white/10 flex items-center gap-6">
                   <div className="w-12 h-12 bg-brand-500/20 rounded-2xl flex items-center justify-center text-brand-400">
                      <i className="fa-solid fa-circle-info"></i>
                   </div>
                   <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
                      Este set garantiza la persistencia facial. El <span className="text-white font-bold">FACEMASTER</span> será inyectado como semilla de identidad en todas las generaciones de productos y lifestyle para evitar variaciones faciales.
                   </p>
                </footer>
              </div>
            )}

            {/* ESTADO IDLE / CARGA INICIAL */}
            {step === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-10">
                <div className="w-40 h-40 bg-white/5 rounded-[60px] flex items-center justify-center text-7xl text-white/10 border border-white/10 shadow-inner">
                  <i className="fa-solid fa-dna animate-pulse"></i>
                </div>
                <div className="space-y-4">
                  <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">Identity Synthesizer</h3>
                  <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto italic leading-relaxed">
                    Protocolo de generación de Activos Maestros para e-commerce de alta escala.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Gallery Modal */}
      {zoomedImageIndex !== null && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
          onClick={closeZoomModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeZoomModal();
            if (e.key === 'ArrowLeft') navigateZoom('prev');
            if (e.key === 'ArrowRight') navigateZoom('next');
          }}
          tabIndex={0}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previews[zoomedImageIndex]} 
              alt={`Avatar Preview ${zoomedImageIndex + 1}`} 
              className="max-w-full max-h-[90vh] object-contain rounded-[40px] md:rounded-[56px] shadow-2xl animate-in zoom-in-50 transition-transform duration-300" 
              style={{ cursor: 'zoom-in' }}
            />

            {/* Close Button */}
            <button 
              onClick={closeZoomModal} 
              className="absolute top-4 right-4 md:top-8 md:right-8 w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-all z-10"
              aria-label="Cerrar galería"
            >
              <i className="fa-solid fa-xmark text-lg md:text-xl"></i>
            </button>

            {/* Navigation Arrows */}
            <button 
              onClick={(e) => { e.stopPropagation(); navigateZoom('prev'); }} 
              className="absolute left-4 md:left-8 w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center text-xl md:text-2xl opacity-80 hover:opacity-100 transition-all hover:scale-110"
              aria-label="Imagen anterior"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); navigateZoom('next'); }} 
              className="absolute right-4 md:right-8 w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center text-xl md:text-2xl opacity-80 hover:opacity-100 transition-all hover:scale-110"
              aria-label="Imagen siguiente"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default CloningModule;