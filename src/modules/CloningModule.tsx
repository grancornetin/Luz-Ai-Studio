// src/modules/CloningModule.tsx
import React, { useState } from 'react';
import { AvatarProfile } from '../types';
import { startClone, waitForCloneComplete } from '../services/avatarCloneService';
import { useCreditGuard } from '../../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../services/creditConfig';
import { readAndCompressFile } from '../utils/imageUtils';
import JSZip from 'jszip';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { generationHistoryService } from '../services/generationHistoryService';

interface CloningModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

const CloningModule: React.FC<CloningModuleProps> = ({ onSave }) => {
  const [name, setName] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zoomedImageIndex, setZoomedImageIndex] = useState<number | null>(null);
  const [gender, setGender] = useState<'hombre' | 'mujer'>('mujer');

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const compressed = await Promise.all(newFiles.map(f => readAndCompressFile(f)));
      setFiles(prev => [...prev, ...compressed].slice(0, 3));
    }
  };

  const startCloning = async () => {
    if (!name || files.length === 0) {
      alert("Nombre y fotos de referencia requeridos.");
      return;
    }
    const ok = await checkAndDeduct(CREDIT_COSTS.CREATE_MODEL_CLONE);
    if (!ok) return;

    setIsLoading(true);
    setStatus('Iniciando clonación asíncrona...');
    setPreviews([]);

    try {
      const { jobId } = await startClone({
        mode: 'image',
        name,
        files,
        gender,
        personality: 'Profesional y elegante',
        expression: 'Natural',
      });

      setStatus('Procesando en segundo plano...');
      const images = await waitForCloneComplete(jobId, (jobStatus, result) => {
        if (jobStatus === 'processing') setStatus('Generando activos maestros...');
        if (result && result.length === 4) setPreviews(result);
      });

      const newAvatar: AvatarProfile = {
        id: Date.now().toString(),
        name,
        type: 'reference',
        identityPrompt: '',
        physicalDescription: '',
        negativePrompt: '',
        baseImages: images,
        metadata: {
          gender,
          age: '',
          build: '',
          ethnicity: '',
          eyes: '',
          hairColor: '',
          hairType: '',
          hairLength: '',
          personality: 'Profesional y elegante',
          expression: 'Natural',
          outfit: '',
        },
        createdAt: Date.now(),
      };
      onSave(newAvatar);

      // Guardar las 4 vistas en historial (body master, rear, side, face)
      const viewLabels = ['Body Master', 'Vista Trasera', 'Vista Lateral', 'Face Master'];
      images.forEach((img, idx) => {
        generationHistoryService.save({
          imageUrl:    img,
          module:      'model_dna',
          moduleLabel: `Model DNA — Por Imagen (${viewLabels[idx] || `Vista ${idx + 1}`})`,
          creditsUsed: idx === 0 ? CREDIT_COSTS.CREATE_MODEL_CLONE : 0,
          promptText:  `Clonación desde imagen — ${name}`,
        }).catch(console.error);
      });

      setStatus('Completado');
    } catch (err: any) {
      alert("Error en clonación: " + err.message);
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
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
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Avatar_DNA_Set_${name}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  };

  const reset = () => {
    setName('');
    setFiles([]);
    setPreviews([]);
    setStatus('');
    setIsLoading(false);
    setZoomedImageIndex(null);
  };

  const openZoomModal = (index: number) => setZoomedImageIndex(index);
  const closeZoomModal = () => setZoomedImageIndex(null);
  const navigateZoom = (direction: 'prev' | 'next') => {
    if (zoomedImageIndex === null) return;
    let newIndex = zoomedImageIndex;
    if (direction === 'prev') newIndex = (zoomedImageIndex - 1 + previews.length) % previews.length;
    else newIndex = (zoomedImageIndex + 1) % previews.length;
    setZoomedImageIndex(newIndex);
  };

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                  disabled={isLoading}
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
                  {files.length < 3 && !isLoading && (
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

              {!isLoading && previews.length === 0 && (
                <button onClick={startCloning} className="w-full py-5 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-brand-700 active:scale-95 transition-all">
                  Sintetizar BODYMASTER
                </button>
              )}

              {(isLoading || status) && previews.length === 0 && (
                <div className="p-6 bg-brand-900 rounded-[32px] text-white flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black uppercase tracking-widest">{status || 'Procesando...'}</p>
                </div>
              )}

              {previews.length === 4 && !isLoading && (
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
          </div>

          <div className="lg:col-span-8">
            <div className="bg-slate-900 rounded-[56px] p-8 md:p-12 min-h-[750px] flex flex-col shadow-2xl relative">
              {previews.length === 0 && !isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-10">
                  <div className="w-40 h-40 bg-white/5 rounded-[60px] flex items-center justify-center text-7xl text-white/10 border border-white/10 shadow-inner">
                    <i className="fa-solid fa-dna animate-pulse"></i>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">Identity Synthesizer</h3>
                    <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto italic leading-relaxed">
                      Protocolo de generación de Activos Maestros para e‑commerce de alta escala.
                    </p>
                  </div>
                </div>
              )}

              {previews.length === 4 && (
                <div className="space-y-10 animate-in fade-in duration-1000">
                  <header className="flex justify-between items-center border-b border-white/10 pb-8">
                    <div>
                      <h3 className="text-white font-black text-3xl uppercase italic tracking-tighter">{name}</h3>
                      <p className="text-brand-400 text-[10px] font-black uppercase tracking-widest">Master Digital Twin Identity Set</p>
                    </div>
                    <button onClick={downloadFullSetZip} className="px-6 py-4 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase border border-white/10 hover:bg-white/20">
                      Pre‑visualizar Set
                    </button>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                      { img: previews[0], label: 'P1: BODYMASTER', sub: 'Frontal Technical' },
                      { img: previews[1], label: 'P2: REAR VIEW', sub: '180° Back view' },
                      { img: previews[2], label: 'P3: SIDE PROFILE', sub: '90° Side view' },
                      { img: previews[3], label: 'P4: FACEMASTER', sub: 'DNA Source 1:1' },
                    ].map((p, i) => (
                      <div
                        key={i}
                        className="group relative aspect-[3/4] rounded-[48px] overflow-hidden bg-white shadow-2xl border-4 border-transparent cursor-pointer"
                        onClick={() => openZoomModal(i)}
                      >
                        <img src={p.img} className="w-full h-full object-cover transition-all duration-700" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.href = p.img;
                              link.download = `${name}_P${i + 1}.png`;
                              link.click();
                            }}
                            className="w-16 h-16 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                          >
                            <i className="fa-solid fa-download text-xl"></i>
                          </button>
                        </div>
                        <div className="absolute top-6 left-6 right-6">
                          <div className="px-5 py-2 bg-black/50 backdrop-blur-xl text-white rounded-2xl border border-white/20 flex justify-between items-center shadow-2xl">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest">{p.label}</p>
                              <p className="text-[7px] text-white/50 font-bold uppercase tracking-widest leading-none mt-0.5">{p.sub}</p>
                            </div>
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
            </div>
          </div>
        </div>

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
              <button
                onClick={closeZoomModal}
                className="absolute top-4 right-4 md:top-8 md:right-8 w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-all z-10"
                aria-label="Cerrar galería"
              >
                <i className="fa-solid fa-xmark text-lg md:text-xl"></i>
              </button>
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