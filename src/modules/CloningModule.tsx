// src/modules/CloningModule.tsx
import React, { useState } from 'react';
import { AvatarProfile } from '../types';
import { startClone, waitForCloneComplete } from '../services/avatarCloneService';
import { useCreditGuard } from '../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../services/creditConfig';
import { readAndCompressFile, downloadAsZip } from '../utils/imageUtils';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { generationHistoryService } from '../services/generationHistoryService';

// Nuevos componentes base
import { ImageSlot } from '../components/shared/ImageSlot';
import { ImageLightbox } from '../components/shared/ImageLightbox';
import { FloatingActionBar } from '../components/shared/FloatingActionBar';
import { useScrollFAB } from '../hooks/useScrollFAB';

interface CloningModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

const CloningModule: React.FC<CloningModuleProps> = ({ onSave }) => {
  const [name, setName] = useState('');
  const [files, setFiles] = useState<string[]>([]); // hasta 3 imágenes en base64
  const [status, setStatus] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gender, setGender] = useState<'hombre' | 'mujer'>('mujer');

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // FAB scroll detection
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  // Handlers para los 3 slots de imagen
  const updateFile = (index: number, base64: string | null) => {
    const newFiles = [...files];
    if (base64 === null) {
      newFiles[index] = undefined as any;
    } else {
      newFiles[index] = base64;
    }
    // Filtrar undefined y mantener máximo 3
    const cleaned = newFiles.filter((f): f is string => f !== undefined).slice(0, 3);
    setFiles(cleaned);
  };

  const startCloning = async () => {
    if (!name || files.length === 0) {
      alert("Nombre y al menos una foto de referencia son requeridos.");
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

      // Guardar las 4 vistas en historial
      const viewLabels = ['Body Master', 'Vista Trasera', 'Vista Lateral', 'Face Master'];
      images.forEach((img, idx) => {
        generationHistoryService.save({
          imageUrl: img,
          module: 'model_dna',
          moduleLabel: `Model DNA — Por Imagen (${viewLabels[idx] || `Vista ${idx + 1}`})`,
          creditsUsed: idx === 0 ? CREDIT_COSTS.CREATE_MODEL_CLONE : 0,
          promptText: `Clonación desde imagen — ${name}`,
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

  const reset = () => {
    setName('');
    setFiles([]);
    setPreviews([]);
    setStatus('');
    setIsLoading(false);
    setLightboxOpen(false);
  };

  const handleDownloadZip = async () => {
    if (previews.length === 0) return;
    await downloadAsZip(previews, `Avatar_DNA_Set_${name || 'avatar'}.zip`, `${name || 'vista'}`);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />

      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Panel izquierdo: configuración */}
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

                {/* Slots de carga con ImageSlot (3 posiciones) */}
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map(i => (
                    <ImageSlot
                      key={i}
                      value={files[i] || null}
                      onChange={(base64) => updateFile(i, base64)}
                      label={i === 0 ? "Frontal" : i === 1 ? "Lateral" : "Extra"}
                      hint="JPG o PNG"
                      aspectRatio="square"
                      disabled={isLoading}
                    />
                  ))}
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
                  <button onClick={reset} className="w-full py-4 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600">
                    Crear Otro Avatar
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Panel derecho: resultados */}
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
                    {/* Botón de descarga rápida (además del FAB) */}
                    <button onClick={handleDownloadZip} className="px-6 py-4 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase border border-white/10 hover:bg-white/20">
                      Descargar Set ZIP
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
                        className="group relative aspect-[3/4] rounded-[48px] overflow-hidden bg-white shadow-2xl border-4 border-transparent cursor-zoom-in"
                        onClick={() => openLightbox(i)}
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

        {/* Lightbox universal */}
        {lightboxOpen && previews.length > 0 && (
          <ImageLightbox
            images={previews}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onDownload={(url, idx) => {
              const link = document.createElement('a');
              link.href = url;
              link.download = `${name}_vista_${idx + 1}.png`;
              link.click();
            }}
            metadata={{ label: `Digital Twin: ${name}` }}
          />
        )}

        {/* Floating Action Bar (FAB) contextual */}
        <FloatingActionBar
          isVisible={previews.length === 4 && fabVisible && !isLoading}
          primaryAction={{
            label: 'Descargar ZIP',
            icon: <i className="fa-solid fa-download text-sm"></i>,
            onClick: handleDownloadZip,
          }}
          onClearSelection={reset}
          selectedCount={0}
        />
      </div>
    </>
  );
};

export default CloningModule;